// All session IDs reserved for seed scripts — both scripts clear all of these on every run
export const ALL_SEED_IDS = [
  // seed.js — persistent dev pins (a-prefix, up to 20 slots)
  ...Array.from({ length: 20 }, (_, i) => `a0000000-0000-0000-0000-${String(i).padStart(12, '0')}`),
  // seed-demo.js — expiring opacity demo (b-prefix, up to 20 slots)
  ...Array.from({ length: 20 }, (_, i) => `b0000000-0000-0000-0000-${String(i).padStart(12, '0')}`),
]
