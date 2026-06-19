/**
 * Persistent dev seed — auth-style thots near your current location, for map UI testing.
 * All pins are permanent (no expiry). Pass your real coords to place them around you.
 *
 * Usage:
 *   node server/seed.js --lat=40.7143 --lng=-74.0060
 *
 * Clears ALL seed data (both seed.js and seed-demo.js) before inserting.
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { ALL_SEED_IDS } from './lib/seed-ids.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('='))
)
const centerLat = parseFloat(args.lat ?? 37.7749)
const centerLng = parseFloat(args.lng ?? -122.4194)

const THOTS = [
  { content: 'anyone else notice how the sky looks different at 3am',           pen_name: 'SkyWatcher3am' },
  { content: 'just dropped my phone in a puddle and it survived. we are SO back', pen_name: 'VoidDrifter' },
  { content: 'the coffee shop on 5th st has free wifi that actually works',      pen_name: 'NeonEcho' },
  { content: 'unpopular opinion: silence is underrated',                         pen_name: 'SilenceDefender' },
  { content: "if you're reading this you're within a mile of me. spooky",        pen_name: 'LiminalTrace' },
  { content: 'this city never actually sleeps it just gets quieter and weirder', pen_name: 'GlitchWalker' },
  { content: 'found a twenty on the sidewalk. today is going to be different',   pen_name: 'TwentyDollarDay' },
  { content: 'the energy out here is something else tonight',                    pen_name: 'PhaseShift' },
]

const OFFSETS = [
  [ 0.0008,  0.0012], [-0.0011,  0.0006], [ 0.0005, -0.0009], [-0.0007, -0.0013],
  [ 0.0014,  0.0003], [-0.0003,  0.0015], [ 0.0010, -0.0005], [-0.0009,  0.0011],
]

const IP_SALT = process.env.IP_SALT ?? 'dev'

async function seed() {
  console.log(`Clearing all seed data…`)
  const { error: delErr } = await supabase.from('thots').delete().in('session_id', ALL_SEED_IDS)
  if (delErr) console.warn('Warning — could not clear seed data:', delErr.message)
  else console.log(`✓ Cleared\n`)

  console.log(`Seeding ${THOTS.length} persistent thots near (${centerLat}, ${centerLng})…`)

  const rows = THOTS.map((t, i) => ({
    content: t.content,
    pen_name: t.pen_name,
    session_id: `a0000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    ip_hash: createHash('sha256').update(`seed-${i}${IP_SALT}`).digest('hex'),
    location: `SRID=4326;POINT(${centerLng + OFFSETS[i][1]} ${centerLat + OFFSETS[i][0]})`,
    created_at: new Date(Date.now() - i * 4 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 100 * 365.25 * 24 * 60 * 60 * 1000).toISOString(),
    is_seed: true,
    hidden: true,
  }))

  const { data, error } = await supabase.from('thots').insert(rows).select('id, content')
  if (error) { console.error('Seed failed:', error.message); process.exit(1) }

  console.log(`✓ Inserted ${data.length} thots:`)
  data.forEach(t => console.log(`  • "${t.content.slice(0, 55)}"`))
}

seed()
