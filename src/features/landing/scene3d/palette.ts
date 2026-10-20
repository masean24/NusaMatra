/**
 * Kapur & Kobalt colours for the WebGL scenes. three.js needs literal values, so these mirror
 * the CSS tokens in src/styles/tokens.css (laut/*, darat/*, aksen/*, prioritas/*).
 */
export const SCENE_PALETTE = {
  sea: '#2f5bff',
  seaDeep: '#1e3fd9',
  seaShallow: '#5c7fff',
  chalkTop: '#fbfaf6',
  chalk2: '#ede9df',
  chalk3: '#d9d3c3',
  chalk4: '#b8af9a',
  orange: '#ff8a3d',
  orangeLight: '#ffb07a',
  orangeDeep: '#d9581a',
  peach: '#ffd9bf',
} as const;
