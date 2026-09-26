// Shipping-label sheet layouts: always 2 columns, 2/4/6/8 rows per A4 sheet.
// The backend (`labels/bulk` view) accepts the same `rows` values and falls back to 4.

export const LABEL_ROW_OPTIONS = [2, 4, 6, 8] as const;
export type LabelRows = (typeof LABEL_ROW_OPTIONS)[number];

export const DEFAULT_LABEL_ROWS: LabelRows = 4;

export function isLabelRows(value: unknown): value is LabelRows {
  return LABEL_ROW_OPTIONS.includes(value as LabelRows);
}
