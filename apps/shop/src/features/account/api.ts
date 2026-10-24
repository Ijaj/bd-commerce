'use client';
import { browserApi } from '~/lib/api-browser';
import { call } from './lib';

/** Thin wrappers over the same-origin customer API (cookie bdc_cs). Every call resolves to ApiResult. */
export const customerApi = {
  requestOtp: (phone: string, purpose: 'signup' | 'reset') =>
    call(browserApi.POST('/v1/customer/auth/otp', { body: { phone, purpose } })),

  signup: (body: { name: string; phone: string; email?: string; password: string; code: string }) =>
    call(browserApi.POST('/v1/customer/auth/signup', { body })),

  login: (login: string, password: string) =>
    call(browserApi.POST('/v1/customer/auth/login', { body: { login, password } })),

  reset: (body: { phone: string; code: string; password: string }) =>
    call(browserApi.POST('/v1/customer/auth/reset', { body })),

  logout: () => call(browserApi.POST('/v1/customer/auth/logout')),

  updateMe: (body: { name?: string; email?: string | null; lang?: 'en' | 'bn' }) =>
    call(browserApi.PATCH('/v1/customer/me', { body })),

  changePassword: (currentPassword: string, newPassword: string) =>
    call(browserApi.POST('/v1/customer/me/password', { body: { currentPassword, newPassword } })),
};
