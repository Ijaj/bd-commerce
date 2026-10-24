import type { components } from '@bdc/api-client';

export type Cart = components['schemas']['CartDto'];
export type CartLine = Cart['items'][number];
