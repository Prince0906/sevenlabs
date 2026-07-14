import type { WordTimestamp } from "@sevenlabs/shared-types";

/** ~12 words in ~4s — fast pace, no pauses */
export const fixtureWordsDense: WordTimestamp[] = [
  { word: "I", start: 0.0, end: 0.1 },
  { word: "led", start: 0.1, end: 0.3 },
  { word: "the", start: 0.3, end: 0.4 },
  { word: "team", start: 0.4, end: 0.6 },
  { word: "to", start: 0.6, end: 0.7 },
  { word: "ship", start: 0.7, end: 0.9 },
  { word: "the", start: 0.9, end: 1.0 },
  { word: "feature", start: 1.0, end: 1.4 },
  { word: "on", start: 1.4, end: 1.5 },
  { word: "time", start: 1.5, end: 1.8 },
  { word: "last", start: 1.8, end: 2.0 },
  { word: "quarter", start: 2.0, end: 2.4 },
];

/** Includes um + 0.8s gap */
export const fixtureWordsWithPauses: WordTimestamp[] = [
  { word: "So", start: 0.0, end: 0.2 },
  { word: "um", start: 0.2, end: 0.4 },
  { word: "we", start: 1.2, end: 1.4 },
  { word: "fixed", start: 1.4, end: 1.7 },
  { word: "the", start: 1.7, end: 1.8 },
  { word: "bug", start: 1.8, end: 2.1 },
  { word: "and", start: 3.0, end: 3.2 },
  { word: "shipped", start: 3.2, end: 3.6 },
];
