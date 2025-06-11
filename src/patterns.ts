export interface Pattern {
  id: string;
  category: string;
  criticality: number;
  pattern: RegExp | string;
  lang: string;
}