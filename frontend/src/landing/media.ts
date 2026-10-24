/**
 * landing/media.ts — the media slot registry (R11.3, R18.1).
 *
 * Each slot declares an id, a kind (image | video), and REQUIRED alt text (or a
 * caption/transcript). Until a `src` is set, the landing renders a hatched
 * placeholder with the caption, so the page is complete before art lands. Video
 * slots are muted and loop. The `alt` requirement is enforced by the type: every
 * slot must provide it.
 */
export interface MediaSlot {
  id: string;
  kind: "image" | "video";
  /** Required accessible description (or a transcript/caption for video). */
  alt: string;
  /** A visible caption shown under the media and in the placeholder. */
  caption: string;
  /** When set, the real asset renders; otherwise a hatched placeholder shows. */
  src?: string;
}

/**
 * Feature-row media slots. Alt/caption are i18n KEYS resolved by the renderer so
 * they stay translatable; no user-facing literal lives here.
 */
export const featureMedia: MediaSlot[] = [
  { id: "feature-1", kind: "image", alt: "landing.feature.1.title", caption: "landing.feature.1.title" },
  { id: "feature-2", kind: "image", alt: "landing.feature.2.title", caption: "landing.feature.2.title" },
  { id: "feature-3", kind: "image", alt: "landing.feature.3.title", caption: "landing.feature.3.title" },
  { id: "feature-4", kind: "image", alt: "landing.feature.4.title", caption: "landing.feature.4.title" },
  { id: "feature-5", kind: "image", alt: "landing.feature.5.title", caption: "landing.feature.5.title" },
  { id: "feature-6", kind: "image", alt: "landing.feature.6.title", caption: "landing.feature.6.title" },
];
