/**
 * Seed sample thots into Supabase for local development.
 *
 * Usage:
 *   node server/seed.js --lat=37.7749 --lng=-122.4194
 *   node server/seed.js --lat=40.7128 --lng=-74.0060
 *
 * Defaults to San Francisco if no coords given.
 * Run from the project root so dotenv finds server/.env.
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Always load server/.env regardless of where the script is invoked from
config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Parse --lat and --lng from argv
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
)
const centerLat = parseFloat(args.lat ?? 37.7749)
const centerLng = parseFloat(args.lng ?? -122.4194)

const THOTS = [
  { content: 'anyone else notice how the sky looks different at 3am', pen_name: null },
  { content: 'just dropped my phone in a puddle and it survived. we are SO back', pen_name: 'VoidDrifter' },
  { content: 'the coffee shop on 5th st has free wifi that actually works', pen_name: 'NeonEcho' },
  { content: 'unpopular opinion: silence is underrated', pen_name: null },
  { content: "if you're reading this you're within a mile of me. spooky", pen_name: 'LiminalTrace' },
  { content: 'this city never actually sleeps it just gets quieter and weirder', pen_name: 'GlitchWalker' },
  { content: 'found a twenty on the sidewalk. today is going to be different', pen_name: null },
  { content: 'the energy out here is something else tonight', pen_name: 'PhaseShift' },
]

// Small lat/lng offsets (~100–600m spread)
const OFFSETS = [
  [0.0008,  0.0012],
  [-0.0011, 0.0006],
  [0.0005, -0.0009],
  [-0.0007,-0.0013],
  [0.0014,  0.0003],
  [-0.0003, 0.0015],
  [0.0010, -0.0005],
  [-0.0009, 0.0011],
]

const IP_SALT = process.env.IP_SALT ?? 'dev'

async function seed() {
  console.log(`Seeding ${THOTS.length} thots near (${centerLat}, ${centerLng})…`)

  // Clear existing seed thots by their known session_ids so re-runs are idempotent
  const seedSessionIds = THOTS.map((_, i) => `a0000000-0000-0000-0000-${String(i).padStart(12, '0')}`)
  const { error: delErr } = await supabase
    .from('thots')
    .delete()
    .in('session_id', seedSessionIds)

  if (delErr) console.warn('Could not clear old seed data:', delErr.message)

  const rows = THOTS.map((t, i) => {
    const lat = centerLat + OFFSETS[i][0]
    const lng = centerLng + OFFSETS[i][1]
    const session_id = `a0000000-0000-0000-0000-${String(i).padStart(12, '0')}`
    const ip_hash = createHash('sha256').update(`seed-${i}${IP_SALT}`).digest('hex')
    return {
      content: t.content,
      pen_name: t.pen_name,
      session_id,
      ip_hash,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      created_at: new Date(Date.now() - i * 4 * 60 * 1000).toISOString(),
    }
  })

  const { data, error } = await supabase.from('thots').insert(rows).select('id, content')

  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }

  console.log(`✓ Inserted ${data.length} thots:`)
  data.forEach(t => console.log(`  • ${t.id}  "${t.content.slice(0, 50)}"`))
}

seed()
