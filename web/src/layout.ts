/**
 * Single-column mode for phones and short viewports.
 *
 * Width alone is not enough: a phone in landscape (≈844×390) is wider than the
 * old 820px breakpoint but far too short for a sidebar plus a terminal, while
 * a tablet in portrait (≈768×1024) is narrower yet has room for both columns.
 * Very wide windows are always desktop.
 */
export function isCompactLayoutSize(width: number, height: number): boolean {
  if (width < 700) {
    return true;
  }
  if (width >= 1100) {
    return false;
  }
  return height < 700;
}

export const COMPACT_LAYOUT_MEDIA_QUERY =
  "(max-width: 699px), (max-width: 1099px) and (max-height: 699px)";
