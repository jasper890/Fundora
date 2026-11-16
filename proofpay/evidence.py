import hashlib
import json
import secrets
import uuid
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from proofpay.models import Award, EvidenceVersion, EvidenceFile, ProgramMember
from proofpay.permissions import require_award_role

MAX_SIZE = 5 * 1024 * 1024


def canonical_manifest(version: EvidenceVersion) -> bytes:
    manifest = {
        "schema": "proofpay-evidence-v1",
        "award": str(version.award_id),
        "revision": version.revision,
        "nonce": version.nonce,
        "files": [
            {
                "filename": f.filename,
                "sha256": f.digest,
                "size": f.size,
                "content_type": f.content_type,
            }
            for f in version.files.order_by("pk")
        ],
        "source_ref": version.source_ref,
        "explanation": version.explanation,
    }
    return json.dumps(
        manifest, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def private_path(name: str) -> Path:
    root = Path(settings.PRIVATE_EVIDENCE_ROOT).resolve()
    path = (root / name).resolve()
    if path.parent != root:
        raise ValidationError("Invalid evidence reference.")
    return path


def verify_evidence(version: EvidenceVersion) -> None:
    if version.purged_at:
        raise ValidationError("Evidence was removed under the retention policy; its commitment remains in the audit record.")
    canonical = canonical_manifest(version)
    if (
        canonical != version.manifest.encode("utf-8")
        or hashlib.sha256(canonical).hexdigest() != version.digest
    ):
        raise ValidationError(
            "Evidence integrity check failed. Contact the program organizer."
        )
    for entry in version.files.all():
        try:
            with private_path(entry.storage_name).open("rb") as handle:
                data = handle.read(MAX_SIZE + 1)
        except OSError:
            raise ValidationError(
                "Evidence is unavailable. Contact the program organizer."
            ) from None
        if len(data) != entry.size or hashlib.sha256(data).hexdigest() != entry.digest:
            raise ValidationError(
                "Evidence integrity check failed. Contact the program organizer."
            )


def store_evidence(
    user,
    award: Award,
    files,
    explanation: str,
    source_ref: str,
    *,
    expected_revision=None,
) -> EvidenceVersion:
    if (
        not explanation.strip()
        or len(explanation) > 2000
        or not source_ref.strip()
        or len(source_ref) > 512
    ):
        raise ValidationError(
            "Provide an explanation up to 2,000 characters and source reference up to 512 characters."
        )
    files = list(files)
    if not 1 <= len(files) <= 3:
        raise ValidationError("Upload between one and three files.")
    prepared = []
    for upload in files:
        name = upload.name
        if (
            not name
            or len(name) > 160
            or any(c in name for c in ("/", chr(92), chr(0)))
            or any(ord(c) < 32 for c in name)
        ):
            raise ValidationError("Use a filename without paths or control characters.")
        data = upload.read(MAX_SIZE + 1)
        ext = Path(name).suffix.lower()
        valid = (
            (
                ext == ".pdf"
                and upload.content_type == "application/pdf"
                and data.startswith(b"%PDF-")
            )
            or (
                ext == ".png"
                and upload.content_type == "image/png"
                and data.startswith(bytes.fromhex("89504e470d0a1a0a"))
            )
            or (
                ext in (".jpg", ".jpeg")
                and upload.content_type == "image/jpeg"
                and data.startswith(bytes.fromhex("ffd8ff"))
            )
        )
        if not valid or not data or len(data) > MAX_SIZE:
            raise ValidationError(
                "Use PDF, JPEG or PNG files up to 5 MiB with matching file content and type."
            )
        prepared.append((upload, data))
    written = []
    try:
        with transaction.atomic():
            award = Award.objects.select_for_update().get(pk=award.pk)
            require_award_role(user, award, {ProgramMember.Role.RECIPIENT})
            if (
                award.status not in (Award.Status.FUNDED, Award.Status.SUBMITTED)
                or timezone.now() > award.program.claim_deadline
            ):
                raise ValidationError(
                    "Evidence can be added only to a funded or submitted award before the claim deadline."
                )
            latest = award.evidence_versions.first()
            prior = latest.revision if latest else 0
            if expected_revision is not None and expected_revision != prior:
                raise ValidationError(
                    "Evidence changed in another tab. Refresh and review the latest revision.",
                    code="stale",
                )
            version = EvidenceVersion.objects.create(
                award=award,
                revision=prior + 1,
                nonce=secrets.token_hex(32),
                manifest="",
                digest="",
                explanation=explanation,
                source_ref=source_ref,
                author=user,
            )
            for upload, data in prepared:
                name = uuid.uuid4().hex + ".bin"
                path = private_path(name)
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open("xb") as handle:
                    written.append(path)
                    handle.write(data)
                EvidenceFile.objects.create(
                    version=version,
                    storage_name=name,
                    filename=upload.name,
                    content_type=upload.content_type,
                    size=len(data),
                    digest=hashlib.sha256(data).hexdigest(),
                )
            manifest = canonical_manifest(version)
            version.manifest = manifest.decode("utf-8")
            version.digest = hashlib.sha256(manifest).hexdigest()
            EvidenceVersion.objects.filter(pk=version.pk).update(
                manifest=version.manifest, digest=version.digest
            )
            return version
    except Exception:
        for path in written:
            path.unlink(missing_ok=True)
        raise
