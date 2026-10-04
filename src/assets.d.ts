// Image imports are inlined by the build as data: URLs (see scripts/build.mjs).
declare module '*.webp' {
  const src: string;
  export default src;
}
