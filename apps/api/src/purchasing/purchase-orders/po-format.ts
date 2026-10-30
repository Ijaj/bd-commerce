/** Paisa as "Tk 1,234.50" for emails (lakh grouping), without pulling in the i18n package. */
export function formatPrice(paisa: number) {
  const sign = paisa < 0 ? '-' : '';
  const abs = Math.abs(paisa);
  const taka = String(Math.floor(abs / 100));
  const last3 = taka.slice(-3);
  const rest = taka.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `${sign}Tk ${grouped}.${String(abs % 100).padStart(2, '0')}`;
}
