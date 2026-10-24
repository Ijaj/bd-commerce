import type { MessageKey } from './en';

/**
 * Bangla strings. Empty on purpose: the owner has not confirmed that the portal is bilingual
 * (admin is EN-only, Q112; memo output is EN/BN, R20). Fill keys here and call setLang('bn');
 * anything missing falls back to English.
 */
export const bn: Partial<Record<MessageKey, string>> = {};
