import { z } from 'zod';

/**
 * Every store setting and feature flag (doc 12 §15, C19). Only admin overrides are stored;
 * a missing row means the default. Later steps add their keys here.
 * `public` settings are readable without auth via GET /v1/public/site.
 */
const localizedText = z.object({ en: z.string().max(500), bn: z.string().max(500) });

const flag = (description: string) =>
  ({
    group: 'Feature flags',
    description,
    schema: z.boolean(),
    default: false,
    public: true,
  }) as const;

export const SETTINGS = {
  maintenance_mode: {
    group: 'Site',
    description:
      'Maintenance mode: shop shows the message and customer API calls get 503. Admin keeps working.',
    schema: z.object({ enabled: z.boolean(), message: localizedText }),
    default: {
      enabled: false,
      message: {
        en: "We're doing some maintenance. Please check back soon.",
        bn: 'রক্ষণাবেক্ষণের কাজ চলছে। একটু পরে আবার আসুন।',
      },
    },
    public: true,
  },
  announcement_bar: {
    group: 'Site',
    description: 'Bar at the top of every shop page, optionally limited to a time window.',
    schema: z
      .object({
        enabled: z.boolean(),
        text: localizedText,
        link: z.string().max(500).nullable(),
        startsAt: z.iso.datetime().nullable(),
        endsAt: z.iso.datetime().nullable(),
      })
      .refine(
        (v) => !v.startsAt || !v.endsAt || v.startsAt < v.endsAt,
        'startsAt must be before endsAt',
      ),
    default: { enabled: false, text: { en: '', bn: '' }, link: null, startsAt: null, endsAt: null },
    public: true,
  },
  staff_session_timeout_min: {
    group: 'Staff',
    description:
      'Sign staff out after this many idle minutes (C16). Per-staff override on the staff record.',
    schema: z
      .number()
      .int()
      .min(5)
      .max(24 * 60),
    default: 8 * 60,
    public: false,
  },
  shop_contact: {
    group: 'Site',
    description: 'Hotline and contact email shown in the shop utility bar and footer.',
    schema: z.object({ hotline: z.string().max(30), email: z.string().max(200) }),
    default: { hotline: '', email: '' },
    public: true,
  },
  home_feed: {
    group: 'Home',
    description:
      'Weighted random home feed (Q16, Q17, Q83). Boosts multiply the chance of appearing early; out-of-stock items get the penalty. Special row (flash sale / recently viewed / event) every N products (Q18).',
    schema: z.object({
      newBoost: z.number().min(0).max(10),
      newDays: z.number().int().min(1).max(90),
      discountBoost: z.number().min(0).max(10),
      ratingBoost: z.number().min(0).max(10),
      pinnedBoost: z.number().min(0).max(10),
      outOfStockPenalty: z.number().min(0).max(1),
      specialRowEvery: z.number().int().min(4).max(100),
    }),
    default: {
      newBoost: 2,
      newDays: 14,
      discountBoost: 1.5,
      ratingBoost: 1.5,
      pinnedBoost: 3,
      outOfStockPenalty: 0.1,
      specialRowEvery: 12,
    },
    public: false,
  },
  customer_session_days: {
    group: 'Customers',
    description: 'Customers stay signed in this many days since last activity.',
    schema: z.number().int().min(1).max(365),
    default: 60,
    public: false,
  },
  checkout: {
    group: 'Checkout',
    description:
      'Guest COD orders at or above guestOtpAboveP (paisa) need SMS OTP (Q81); max quantity per line.',
    schema: z.object({
      guestOtpAboveP: z.number().int().min(0),
      maxQtyPerLine: z.number().int().min(1).max(999),
    }),
    default: { guestOtpAboveP: 500000, maxQtyPerLine: 10 },
    public: true,
  },
  guest_orders: {
    group: 'Checkout',
    description:
      'Abuse limits (C44). Guests: open orders per phone and daily order value per phone (paisa). Everyone: placed orders per IP per hour.',
    schema: z.object({
      maxOpenPerPhone: z.number().int().min(1).max(100),
      dailyCapP: z.number().int().min(0),
      perIpPerHour: z.number().int().min(1).max(1000),
    }),
    default: { maxOpenPerPhone: 3, dailyCapP: 2_000_000, perIpPerHour: 5 },
    public: false,
  },
  sr_default_commission_bp: {
    group: 'SR / B2B',
    description: 'SR commission in basis points of money collected (Q120), unless set per SR.',
    schema: z.number().int().min(0).max(10000),
    default: 100,
    public: false,
  },
  online_payments_enabled: flag('Online payments at checkout (off for the COD-only launch)'),
  advance_payments_enabled: flag('Advance payment on COD orders (Q106)'),
  preorders_enabled: flag('Pre-order products can be bought (Q109)'),
} as const satisfies Record<
  string,
  { group: string; description: string; schema: z.ZodType; default: unknown; public: boolean }
>;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]['schema']>;
export type SettingsMap = { [K in SettingKey]: SettingValue<K> };

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTINGS, key);
}
