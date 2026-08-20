// Product media rules — one source of truth for the editor (client
// validation before anything is sent) and /api/upload (server mirror).

export const IMAGE_SPEC = {
  types: ['image/jpeg', 'image/png', 'image/webp'],
  typeLabel: 'JPG, PNG or WebP',
  minWidth: 800,
  minHeight: 800,
  maxBytes: 5 * 1024 * 1024,
  sizeLabel: '5 MB',
  /** Shown under the Images heading. */
  text: 'JPG, PNG or WebP · square (1:1) works best · at least 800×800 px · up to 5 MB each',
} as const;

export const VIDEO_SPEC = {
  types: ['video/mp4', 'video/webm'],
  typeLabel: 'MP4 or WebM',
  maxBytes: 50 * 1024 * 1024,
  sizeLabel: '50 MB',
  maxSeconds: 60,
  /** Shown under the video heading. */
  text: 'MP4 or WebM · 16:9 or 9:16 · up to 60 seconds · up to 50 MB',
} as const;

export const fmtBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
