// All session IDs reserved for seed scripts — clear all of these on a full reset
export const ALL_SEED_IDS = [
  // seed.js — persistent dev pins (a-prefix, 20 slots)
  ...Array.from({ length: 20 }, (_, i) => `a0000000-0000-0000-0000-${String(i).padStart(12, '0')}`),
  // seed-demo.js — NYC neighborhoods (b-prefix, 85 slots)
  ...Array.from({ length: 85 }, (_, i) => `b0000000-0000-0000-0000-${String(i).padStart(12, '0')}`),
  // seed-weho.js — West Hollywood (c-prefix, 85 slots)
  ...Array.from({ length: 85 }, (_, i) => `c0000000-0000-0000-0000-${String(i).padStart(12, '0')}`),
  // seed-sf.js — San Francisco (d-prefix, 85 slots)
  ...Array.from({ length: 85 }, (_, i) => `d0000000-0000-0000-0000-${String(i).padStart(12, '0')}`),
  // seed-pittsburgh.js — Pittsburgh (e-prefix, 85 slots)
  ...Array.from({ length: 85 }, (_, i) => `e0000000-0000-0000-0000-${String(i).padStart(12, '0')}`),
]

// Per-city ID ranges for targeted toggle/status operations
export const CITY_SEED_IDS = {
  nyc:        Array.from({ length: 85 }, (_, i) => `b0000000-0000-0000-0000-${String(i).padStart(12, '0')}`),
  weho:       Array.from({ length: 85 }, (_, i) => `c0000000-0000-0000-0000-${String(i).padStart(12, '0')}`),
  sf:         Array.from({ length: 85 }, (_, i) => `d0000000-0000-0000-0000-${String(i).padStart(12, '0')}`),
  pittsburgh: Array.from({ length: 85 }, (_, i) => `e0000000-0000-0000-0000-${String(i).padStart(12, '0')}`),
}
