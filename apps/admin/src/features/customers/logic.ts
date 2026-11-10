/** Two-letter avatar text: "Alice Khan" -> "AK". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => Array.from(p)[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  );
}

export type Tri = 'any' | '0' | '1';

/** Select value -> API flag (omitted when "any"). */
export const flag = (v: Tri): '0' | '1' | undefined => (v === 'any' ? undefined : v);

export const averageOrderP = (orderCount: number, spentP: number): number =>
  orderCount > 0 ? Math.round(spentP / orderCount) : 0;
