import type { SettingsService } from '../settings/settings.service';

const HIGH_P = 100_000_000;

/** Dev-friendly overrides for manual alpha testing: no OTP walls, no abuse limits, no call queue noise. */
export async function applyAlphaSettings(settings: SettingsService) {
  const checkout = await settings.get('checkout');
  const guestOrders = await settings.get('guest_orders');
  const callQueue = await settings.get('call_queue');
  const returns = await settings.get('returns');
  const next = {
    checkout: { ...checkout, guestOtpAboveP: HIGH_P },
    guest_orders: { ...guestOrders, maxOpenPerPhone: 100, dailyCapP: HIGH_P, perIpPerHour: 1000 },
    call_queue: { ...callQueue, firstGuest: false },
    returns: { ...returns, refundApprovalAboveP: HIGH_P },
  };
  for (const [key, value] of Object.entries(next)) await settings.set(key, value, null);
  return Object.keys(next);
}

export async function resetAlphaSettings(settings: SettingsService) {
  const keys = ['checkout', 'guest_orders', 'call_queue', 'returns'];
  for (const key of keys) await settings.reset(key);
  return keys;
}
