import Image from "next/image";

type MenuCardImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
};

const DEFAULT_CLASS =
  "w-full h-auto object-contain rounded-xl shadow-lg mx-auto contrast-[1.15] brightness-[1.08] sm:contrast-[1.10] sm:brightness-[1.05]";

/** Affiche la carte physique (fichier local ou URL distante Vercel Blob). */
export default function MenuCardImage({
  src,
  alt,
  priority,
  className = DEFAULT_CLASS,
}: MenuCardImageProps) {
  if (src.startsWith("http")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={className} loading={priority ? "eager" : "lazy"} />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={1600}
      height={2263}
      quality={90}
      sizes="(max-width: 768px) 100vw, 900px"
      className={className}
      priority={priority}
    />
  );
}
