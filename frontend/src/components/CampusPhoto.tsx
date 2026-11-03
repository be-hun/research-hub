import Image from "next/image";
import type { CampusPhoto as Photo } from "@/lib/photos";

/** A credited campus photo. The credit (author, license, source link) is always visible, as the licenses require. */
export default function CampusPhoto({
  photo,
  className = "",
  aspect = "aspect-[4/3]",
  sizes = "(min-width: 768px) 440px, 100vw",
  priority = false,
}: {
  photo: Photo;
  className?: string;
  aspect?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <figure className={className}>
      <div className={`relative ${aspect} rounded-2xl overflow-hidden shadow-card bg-canvas`}>
        <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
      <PhotoCredit photo={photo} className="mt-2" />
    </figure>
  );
}

export function PhotoCredit({ photo, className = "" }: { photo: Photo; className?: string }) {
  return (
    <figcaption className={`text-tiny text-ink-3 ${className}`}>
      {photo.caption}. Photo:{" "}
      <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
        {photo.author}
      </a>
      ,{" "}
      <a href={photo.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
        {photo.license}
      </a>
    </figcaption>
  );
}
