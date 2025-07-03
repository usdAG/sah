export interface Pattern {
  id: string;
  description: string;
  criticality: string;
  pattern: RegExp | string;
  lang: string;
}