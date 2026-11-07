/** Fixed server-selected formats; callers never supply arbitrary pixel sizes. */
export const imageFormats={
  equipment:{size:"1024x1024",ratio:1},
  "site-cover":{size:"1536x512",ratio:3},
  phase:{size:"1536x1024",ratio:1.5},
  brand:{size:"1024x1024",ratio:1},
} as const;
export type ImagePlacement=keyof typeof imageFormats;
