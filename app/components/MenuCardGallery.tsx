import MenuCardImage from "@/app/components/MenuCardImage";
import { DEFAULT_MENU_CARD_PAGES } from "@/lib/settings";

type MenuCardGalleryProps = {
  alt: string;
  priorityFirst?: boolean;
  className?: string;
};

/** Affiche la carte Oran complète (3 pages) sur l'accueil et les tables. */
export default function MenuCardGallery({
  alt,
  priorityFirst = true,
  className,
}: MenuCardGalleryProps) {
  return (
    <div className="space-y-4">
      {DEFAULT_MENU_CARD_PAGES.map((src, index) => (
        <MenuCardImage
          key={src}
          src={src}
          alt={`${alt} — page ${index + 1}`}
          priority={priorityFirst && index === 0}
          className={className}
        />
      ))}
    </div>
  );
}
