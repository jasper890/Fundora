import Image from "next/image";
import Link from "next/link";

export function BrandLink({ href }: { href: string }) {
  return (
    <Link className="brand" href={href} aria-label="Fundora home">
      <Image className="brand-logo" src="/fundora-logo-transparent.png" width={304} height={204} alt="" />
    </Link>
  );
}
