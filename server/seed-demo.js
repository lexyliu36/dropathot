/**
 * Demo seed — 15 thots spread across the 24hr expiry window to show the opacity fade.
 * Each thot is aged differently so you can see the full gradient from fresh → almost-gone.
 *
 * Usage:
 *   node server/seed-demo.js --lat=40.7143 --lng=-74.0060
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { ALL_SEED_IDS } from './lib/seed-ids.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
)
const centerLat = parseFloat(args.lat ?? 37.7749)
const centerLng = parseFloat(args.lng ?? -122.4194)

// 15 thots — ageHours controls how old each one is (and therefore how faded it looks)
const THOTS = [
  { content: 'just got here, what is everyone doing tonight',          pen_name: 'NeonEcho',    ageHours: 0.5  },
  { content: 'the taco spot by the park is open late, highly recommend', pen_name: null,         ageHours: 1.5  },
  { content: 'lost my keys somewhere between here and the L train',    pen_name: 'GlitchWalker', ageHours: 3   },
  { content: 'does anyone else feel like this city is a simulation',   pen_name: null,           ageHours: 4.5  },
  { content: 'just dropped my phone in a puddle and it survived. we are SO back', pen_name: 'VoidDrifter', ageHours: 6 },
  { content: 'the coffee shop on 5th has free wifi that actually works', pen_name: 'LiminalTrace', ageHours: 7.5 },
  { content: 'unpopular opinion: silence is underrated',               pen_name: null,           ageHours: 9   },
  { content: 'found a twenty on the sidewalk. today is going to be different', pen_name: 'PhaseShift', ageHours: 10.5 },
  { content: 'if you can read this you are within a mile of me. spooky', pen_name: null,         ageHours: 12  },
  { content: 'this city never actually sleeps it just gets quieter and weirder', pen_name: 'ObsidianNomad', ageHours: 14 },
  { content: 'anyone else notice how the sky looks different at 3am',  pen_name: null,           ageHours: 16  },
  { content: 'the energy out here tonight is something else entirely', pen_name: 'WiredSpecter', ageHours: 18  },
  { content: 'overheard the wildest conversation at the bodega just now', pen_name: null,        ageHours: 20  },
  { content: 'been sitting on this bench for two hours and no regrets', pen_name: 'FaintSignal', ageHours: 21.5 },
  { content: 'almost gone. was here though',                           pen_name: null,           ageHours: 23  },
]

// Scatter positions within ~600m of center (spread enough to be readable at zoom 16)
const OFFSETS = [
  [ 0.0030,  0.0020], [-0.0025,  0.0015], [ 0.0018, -0.0028],
  [-0.0032, -0.0010], [ 0.0022,  0.0035], [-0.0015,  0.0030],
  [ 0.0038, -0.0018], [-0.0028,  0.0025], [ 0.0010, -0.0038],
  [-0.0040,  0.0005], [ 0.0028,  0.0012], [-0.0012, -0.0032],
  [ 0.0035,  0.0028], [-0.0020, -0.0022], [ 0.0008,  0.0040],
]

const DEMO_PREFIX = 'b0000000-0000-0000-0000-'
const IP_SALT = process.env.IP_SALT ?? 'dev'

async function seed() {
  console.log(`Seeding ${THOTS.length} demo thots near (${centerLat}, ${centerLng})…`)
  console.log('Ages range from 30min (full opacity) → 23hr (almost invisible)\n')

  console.log('Clearing all seed data…')
  const { error: delErr } = await supabase.from('thots').delete().in('session_id', ALL_SEED_IDS)
  if (delErr) console.warn('Warning — could not clear seed data:', delErr.message)
  else console.log('✓ Cleared\n')

  const rows = THOTS.map((t, i) => {
    const lat = centerLat + OFFSETS[i][0]
    const lng = centerLng + OFFSETS[i][1]
    const session_id = `${DEMO_PREFIX}${String(i).padStart(12, '0')}`
    const ip_hash = createHash('sha256').update(`demo-${i}${IP_SALT}`).digest('hex')
    const createdAt = new Date(Date.now() - t.ageHours * 60 * 60 * 1000)
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000)
    return {
      content: t.content,
      pen_name: t.pen_name,
      session_id,
      ip_hash,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    }
  })

  const { data, error } = await supabase.from('thots').insert(rows).select('id, content, created_at')

  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }

  console.log(`✓ Inserted ${data.length} thots:`)
  THOTS.forEach((t, i) => {
    const opacity = Math.max(0.05, 1 - t.ageHours / 24)
    console.log(`  ${(opacity * 100).toFixed(0).padStart(3)}% opacity  ${t.ageHours}h old  "${t.content.slice(0, 45)}"`)
  })
}

seed()
