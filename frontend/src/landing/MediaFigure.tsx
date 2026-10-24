/**
 * landing/MediaFigure.tsx — renders a media slot (R11.3).
 *
 * Shows the real image/video when `src` is set (video muted + looping with a
 * caption), otherwise a hatched placeholder carrying the caption. Alt/caption
 * are i18n keys resolved through t(). (Named MediaFigure to avoid a case clash
 * with the media.ts registry on case-insensitive filesystems.)
 */
import { useT } from "@/i18n/useLocale";
import type { MediaSlot } from "./media";

export function MediaFigure({ slot }: { slot: MediaSlot }) {
  const t = useT();
  const alt = t(slot.alt);
  const caption = t(slot.caption);

  if (!slot.src) {
    return (
      <figure className="media media--placeholder">
        <div className="media__hatch" role="img" aria-label={alt} />
        <figcaption>{caption}</figcaption>
      </figure>
    );
  }

  return (
    <figure className="media">
      {slot.kind === "video" ? (
        <video className="media__asset" src={slot.src} muted loop autoPlay playsInline aria-label={alt} />
      ) : (
        <img className="media__asset" src={slot.src} alt={alt} />
      )}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
