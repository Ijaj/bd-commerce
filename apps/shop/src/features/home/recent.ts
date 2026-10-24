import { parseRecent } from './logic';

/**
 * Recently viewed ids (C29: browser localStorage only). Key `bdc_recent` is written by the product page.
 * TODO(lead): swap to the shared storage helper from features/browse if agent D exports one.
 */
export const RECENT_KEY = 'bdc_recent';

export function readRecentIds(max = 12): string[] {
  try {
    return parseRecent(window.localStorage.getItem(RECENT_KEY), max);
  } catch {
    return [];
  }
}
