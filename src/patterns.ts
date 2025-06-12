export interface Pattern {
  id: string;
  description: string;
  criticality: number;
  pattern: RegExp | string;
  lang: string;
}