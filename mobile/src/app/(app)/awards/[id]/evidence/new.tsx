import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Card, Field, Heading, Loading, Notice, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useAward } from '@/hooks/use-awards';
import { api } from '@/lib/api/client';
import { addPdf, addPhoto, clearDrafts, listDrafts, putDraft, removeDraft } from '@/lib/evidence/drafts';
import { MAX_EVIDENCE_FILES, MAX_EXPLANATION, MAX_SOURCE_REF, validateFields } from '@/lib/evidence/rules';
import { uploadEvidence, type DraftFile, type UploadStep } from '@/lib/evidence/upload';

const STEP_TEXT: Record<UploadStep, (n: number, total: number) => string> = {
  beginning: () => 'Preparing a private upload…',
  uploading: (n, total) => `Uploading file ${n + 1} of ${total}…`,
  finalizing: () => 'Checking files on the server…',
};

export default function AddEvidenceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  usePreventScreenCapture(); // Android FLAG_SECURE: no screenshots or app-switcher thumbnails of evidence
  const queryClient = useQueryClient();
  const { data } = useAward(id);
  // Drafts from an interrupted attempt are still on the phone: start with them.
  const [files, setFiles] = useState<DraftFile[]>(() => listDrafts(id));
  const [explanation, setExplanation] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<{ text: string; settings?: boolean } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  if (!data) return <Loading />;
  const room = MAX_EVIDENCE_FILES - files.length;
  const busy = progress !== null;

  const add = async (pick: () => Promise<DraftFile[]>) => {
    setProblem(null);
    try {
      const added = await pick();
      setFiles((current) => {
        const next = [...current, ...added];
        next.slice(MAX_EVIDENCE_FILES).forEach(removeDraft); // never keep files the form will not send
        return next.slice(0, MAX_EVIDENCE_FILES);
      });
    } catch (e) {
      setProblem({ text: e instanceof Error ? e.message : 'Could not add that file.' });
    }
  };

  const takePhoto = () =>
    add(async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setProblem({ text: 'Camera access is off for Fundora. You can still choose photos or a PDF.', settings: true });
        return [];
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
      return result.canceled ? [] : [await addPhoto(id, result.assets[0].uri, nextIndex(files))];
    });

  const choosePhotos = () =>
    add(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: room,
        quality: 1,
        exif: false,
      });
      if (result.canceled) return [];
      const added: DraftFile[] = [];
      for (const asset of result.assets.slice(0, room)) {
        added.push(await addPhoto(id, asset.uri, nextIndex([...files, ...added])));
      }
      return added;
    });

  const choosePdf = () =>
    add(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (result.canceled) return [];
      return [addPdf(id, result.assets[0].uri, result.assets[0].name)];
    });

  const upload = async () => {
    const fieldErrors = validateFields(explanation, sourceRef);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length || files.length === 0) {
      if (files.length === 0) setProblem({ text: 'Add at least one photo or PDF.' });
      return;
    }
    setProblem(null);
    try {
      await uploadEvidence(
        { awardId: id, expectedRevision: data.award.evidence_revision, explanation, sourceRef, files },
        { api, put: putDraft },
        (step, n) => setProgress(STEP_TEXT[step](n, files.length)),
      );
      clearDrafts(id);
      await queryClient.invalidateQueries({ queryKey: ['award', id] });
      await queryClient.invalidateQueries({ queryKey: ['awards'] });
      router.back();
    } catch (e) {
      setProblem({ text: e instanceof Error ? e.message : 'Upload failed. Your draft is kept — try again.' });
      await queryClient.invalidateQueries({ queryKey: ['award', id] });
    } finally {
      setProgress(null);
    }
  };

  return (
    <Screen header>
      <Body muted>
        Add up to {MAX_EVIDENCE_FILES} photos or PDFs (5 MB each). Photos are resized and their location data is removed
        before upload.
      </Body>
      {problem ? <Notice tone="danger">{problem.text}</Notice> : null}
      {problem?.settings ? <Button title="Open Settings" variant="secondary" onPress={() => Linking.openSettings()} /> : null}

      <View style={styles.actions}>
        {/* Primary until something is added; then "Upload evidence" becomes the one primary action. */}
        <Button
          grow
          title="Camera"
          label="Take a photo"
          variant={files.length === 0 ? 'primary' : 'secondary'}
          onPress={takePhoto}
          disabled={room === 0 || busy}
        />
        <Button grow title="Photos" label="Choose photos" variant="secondary" onPress={choosePhotos} disabled={room === 0 || busy} />
        <Button grow title="PDF" label="Choose a PDF" variant="secondary" onPress={choosePdf} disabled={room === 0 || busy} />
      </View>
      {room === 0 ? <Body muted>That is the maximum of {MAX_EVIDENCE_FILES} files. Remove one to add another.</Body> : null}

      <Heading>
        Files ({files.length}/{MAX_EVIDENCE_FILES})
      </Heading>
      {files.length === 0 ? <Notice>No files yet.</Notice> : null}
      {files.map((file) => (
        <Card key={file.uri}>
          <View style={styles.file}>
            {file.type === 'application/pdf' ? null : (
              <Image
                source={{ uri: file.uri }}
                cachePolicy="none"
                style={styles.thumb}
                accessibilityLabel={`Preview of ${file.name}`}
              />
            )}
            <View style={styles.fileText}>
              <Body>{file.name}</Body>
              <Body muted>{fileSize(file.size)}</Body>
            </View>
            <Button
              compact
              title="Remove"
              label={`Remove ${file.name}`}
              variant="secondary"
              disabled={busy}
              onPress={() => {
                removeDraft(file);
                setFiles((current) => current.filter((f) => f.uri !== file.uri));
              }}
            />
          </View>
        </Card>
      ))}

      <Field
        label="What does this evidence show?"
        value={explanation}
        onChangeText={setExplanation}
        multiline
        max={MAX_EXPLANATION}
        error={errors.explanation}
        editable={!busy}
      />
      <Field
        label="Source record for the verifier"
        placeholder="e.g. Site inspection log, page 4"
        value={sourceRef}
        onChangeText={setSourceRef}
        max={MAX_SOURCE_REF}
        error={errors.sourceRef}
        editable={!busy}
      />
      {progress ? <Notice tone="progress">{progress}</Notice> : null}
      <Button
        title={files.length ? `Upload ${files.length} file${files.length === 1 ? '' : 's'}` : 'Upload evidence'}
        variant={files.length ? 'primary' : 'secondary'}
        onPress={upload}
        loading={busy}
        disabled={files.length === 0}
        hint={files.length === 0 ? 'Add a photo or PDF first' : undefined}
      />
      <Notice>Uploaded evidence is a draft until you sign its submission with this phone&apos;s Testnet wallet or on the web.</Notice>
    </Screen>
  );
}

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Next free photo-N slot, so a removed photo's name is reused rather than overwritten. */
function nextIndex(files: DraftFile[]): number {
  const used = new Set(files.map((f) => f.name));
  let i = 0;
  while (used.has(`photo-${i + 1}.jpg`)) i += 1;
  return i;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two },
  file: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: Radius.small },
  fileText: { flex: 1, gap: 2 },
});
