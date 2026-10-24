'use client';
import { browserApi } from '~/lib/api-browser';

export type Place = { id: number; nameEn: string; nameBn: string };
export type District = Place & { divisionId: number };
export type Upazila = Place & { districtId: number };

/**
 * Bangladesh geo lists. They almost never change (the API caches them for a day), so each list
 * is fetched once per page load and shared by every address form. A failed fetch is not cached.
 */
let divisions: Promise<Place[]> | null = null;
let districts: Promise<District[]> | null = null;
const upazilas = new Map<number, Promise<Upazila[]>>();

function once<T>(load: () => Promise<{ data?: T; response: Response }>, drop: () => void) {
  return load().then(
    (r) => {
      if (r.response.ok && r.data) return r.data;
      drop();
      throw new Error(`geo ${r.response.status}`);
    },
    (e) => {
      drop();
      throw e;
    },
  );
}

export function loadDivisions(): Promise<Place[]> {
  divisions ??= once(
    () => browserApi.GET('/v1/public/geo/divisions'),
    () => {
      divisions = null;
    },
  );
  return divisions;
}

/** All districts with their division, so both the cascade and edit forms can resolve a division. */
export function loadDistricts(): Promise<District[]> {
  districts ??= once(
    () => browserApi.GET('/v1/public/geo/districts', { params: { query: {} } }),
    () => {
      districts = null;
    },
  );
  return districts;
}

export function loadUpazilas(districtId: number): Promise<Upazila[]> {
  let p = upazilas.get(districtId);
  if (!p) {
    p = once(
      () => browserApi.GET('/v1/public/geo/upazilas', { params: { query: { districtId } } }),
      () => {
        upazilas.delete(districtId);
      },
    );
    upazilas.set(districtId, p);
  }
  return p;
}

/** Test helper. */
export function resetGeo() {
  divisions = null;
  districts = null;
  upazilas.clear();
}
