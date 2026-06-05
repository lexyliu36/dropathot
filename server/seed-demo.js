/**
 * Demo seed — 85 thots spread across NYC neighborhoods.
 * Hell's Kitchen · Central Park · Williamsburg · Queens · LES · FiDi
 *
 * anonymous thots default to 3 hours visibility.
 * named (auth) thots are permanent.
 *
 * Usage:
 *   node server/seed-demo.js
 *
 * Clears all seed data before inserting.
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { ALL_SEED_IDS } from './lib/seed-ids.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const IP_SALT = process.env.IP_SALT ?? 'dev'
const DEMO_PREFIX = 'b0000000-0000-0000-0000-'
const PERMANENT = new Date(Date.now() + 100 * 365.25 * 24 * 3600 * 1000).toISOString()

// 85 thots. pen_name=null → anonymous (3h). pen_name=string → auth (permanent).
const THOTS = [
  // ── Hell's Kitchen (42nd–57th St, 8th–12th Ave) ─────────────────────────────────
  { content: 'the curtain just dropped next door and i could feel the applause through the walls',               pen_name: null,           lat: 40.7578, lng: -73.9942 },
  { content: '9th avenue at midnight hits different every single time',                                          pen_name: 'NeonEcho',     lat: 40.7663, lng: -73.9974 },
  { content: '$3 halal cart on 46th just made my entire night',                                                  pen_name: null,           lat: 40.7712, lng: -73.9888 },
  { content: 'why do tourists always stop in the middle of the sidewalk specifically here',                      pen_name: 'GlitchWalker', lat: 40.7592, lng: -74.0052 },
  { content: 'just saw two broadway stars arguing at a corner diner and did not look away for a second',         pen_name: null,           lat: 40.7689, lng: -73.9921 },
  { content: 'this neighborhood is half chaos half magic and i refuse to leave',                                 pen_name: 'PhaseShift',   lat: 40.7623, lng: -73.9903 },
  { content: 'the bodega on 9th has the best BEC in the city and i will die on this hill',                      pen_name: null,           lat: 40.7641, lng: -74.0009 },
  { content: 'overheard someone practicing their lines on the fire escape. this city man.',                      pen_name: 'LiminalTrace', lat: 40.7554, lng: -73.9963 },
  { content: 'a taxi honked at me and i nodded like we both understood something profound',                     pen_name: null,           lat: 40.7731, lng: -73.9947 },
  { content: 'three tour buses and zero cabs. classic hells kitchen.',                                          pen_name: 'VoidDrifter',  lat: 40.7608, lng: -73.9876 },
  { content: 'it smells like rain and garlic and ambition out here tonight',                                    pen_name: null,           lat: 40.7667, lng: -74.0041 },
  { content: 'diner at 2am is the only honest institution left in this city',                                   pen_name: null,           lat: 40.7574, lng: -74.0018 },
  { content: 'someone left a playbill on this bench and i am keeping it forever',                               pen_name: 'CrypticTide',  lat: 40.7699, lng: -73.9895 },
  { content: 'the gym across the street has been full at every hour i have checked. who are these people.',     pen_name: null,           lat: 40.7618, lng: -73.9982 },
  { content: 'walked past the same delivery guy four times tonight. we are friends now. we have history.',      pen_name: null,           lat: 40.7745, lng: -73.9956 },

  // ── Central Park ─────────────────────────────────────────────────────────────────
  { content: 'the reservoir at golden hour made me forget i have 47 unread emails',                             pen_name: 'NeonEcho',     lat: 40.7876, lng: -73.9602 },
  { content: 'watched a guy do tai chi while a tourist asked him for directions. he did not break form.',       pen_name: null,           lat: 40.7719, lng: -73.9714 },
  { content: 'the park at 6am belongs to runners and raccoons and absolutely nobody else',                     pen_name: 'ObsidianNomad',lat: 40.7801, lng: -73.9723 },
  { content: 'a duck stared at my sandwich for four straight minutes. total standoff.',                         pen_name: null,           lat: 40.7696, lng: -73.9804 },
  { content: 'a string quartet just appeared near the fountain for no reason. just new york things.',          pen_name: null,           lat: 40.7773, lng: -73.9682 },
  { content: 'this bench has seen everything. you can feel it.',                                                pen_name: 'WiredSpecter', lat: 40.7841, lng: -73.9749 },
  { content: 'a dog sprinted at a pigeon full speed and the pigeon did not even flinch. legends only.',        pen_name: null,           lat: 40.7677, lng: -73.9786 },
  { content: 'bethesda fountain is the one place in manhattan that forgets it is manhattan',                    pen_name: 'FaintSignal',  lat: 40.7740, lng: -73.9749 },
  { content: 'old man feeding pigeons in the rain. living his absolute best life honestly.',                    pen_name: null,           lat: 40.7831, lng: -73.9661 },
  { content: 'found a quiet clearing by the lake. sharing the coordinates with no one.',                        pen_name: 'GhostFreq',    lat: 40.7862, lng: -73.9647 },
  { content: 'every time i come here i forget the city exists for about six minutes',                           pen_name: null,           lat: 40.7908, lng: -73.9578 },
  { content: 'kids chasing a kite across the great lawn like they own the whole sky',                           pen_name: null,           lat: 40.7928, lng: -73.9527 },

  // ── Williamsburg ──────────────────────────────────────────────────────────────────
  { content: 'this coffee is $9 and i will pay it every single day until i die',                                pen_name: null,           lat: 40.7143, lng: -73.9626 },
  { content: 'every building here was a warehouse once. that is literally the whole vibe.',                     pen_name: 'VoidDrifter',  lat: 40.7219, lng: -73.9501 },
  { content: 'watched a guy try to parallel park a cargo bike for eight minutes straight',                      pen_name: null,           lat: 40.7168, lng: -73.9563 },
  { content: 'the mural on bedford just changed again. still excellent.',                                       pen_name: 'NeonEcho',     lat: 40.7189, lng: -73.9602 },
  { content: 'somehow found a show that starts at midnight that is also a farmers market',                      pen_name: null,           lat: 40.7232, lng: -73.9476 },
  { content: 'three people in this coffee shop are writing screenplays. you can feel it in the air.',          pen_name: 'GlitchWalker', lat: 40.7151, lng: -73.9587 },
  { content: 'moving to brooklyn was simultaneously the best and worst decision i ever made',                   pen_name: null,           lat: 40.7208, lng: -73.9533 },
  { content: 'the williamsburg bridge at sunset is a protected cultural experience change my mind',             pen_name: 'LiminalTrace', lat: 40.7171, lng: -73.9649 },
  { content: 'a cat is sitting outside the bodega like it owns the door. and honestly it does.',               pen_name: null,           lat: 40.7244, lng: -73.9518 },
  { content: 'the vintage shop on north 7th has a jacket that contains my entire personality',                  pen_name: 'PhaseShift',   lat: 40.7163, lng: -73.9571 },
  { content: 'overheard "this used to be so authentic" for the third time today alone',                        pen_name: null,           lat: 40.7198, lng: -73.9624 },
  { content: 'rooftop party down the block, did not get invited, the music is great from here honestly',       pen_name: null,           lat: 40.7134, lng: -73.9601 },
  { content: 'the pizza place with no yelp page is always always always the right call',                        pen_name: 'VoidDrifter',  lat: 40.7223, lng: -73.9487 },
  { content: 'found graffiti that said be here now. still working on it.',                                     pen_name: null,           lat: 40.7180, lng: -73.9543 },
  { content: 'this neighborhood smells like oat milk and ambition and a little bit of regret',                 pen_name: 'CrypticTide',  lat: 40.7257, lng: -73.9462 },

  // ── Queens (Astoria / LIC / Flushing) ────────────────────────────────────────────
  { content: 'astoria park at sunset makes me feel like everything is going to be okay',                        pen_name: null,           lat: 40.7793, lng: -73.9271 },
  { content: 'the gyro place on ditmars is better than anything in manhattan and i said what i said',          pen_name: 'ObsidianNomad',lat: 40.7716, lng: -73.9346 },
  { content: 'outer borough loyalty is a different kind of love. quiet but total.',                             pen_name: null,           lat: 40.7658, lng: -73.9413 },
  { content: 'a yia yia just handed me spanakopita through her window. this is why i live here.',              pen_name: null,           lat: 40.7684, lng: -73.9373 },
  { content: 'queens has food from every country on earth and midtown has $22 salads',                         pen_name: 'WiredSpecter', lat: 40.7742, lng: -73.9286 },
  { content: 'the N train gets you where you need to go and i will not hear anything against it',              pen_name: null,           lat: 40.7728, lng: -73.9352 },
  { content: 'astoria pool is closed for the season but the view from outside still hits',                     pen_name: null,           lat: 40.7673, lng: -73.9419 },
  { content: 'waited an hour for this dumpling. would do it again without hesitation.',                        pen_name: 'FaintSignal',  lat: 40.7751, lng: -73.9311 },
  { content: 'this block has been the same since 1989 and that is a feature not a bug',                        pen_name: null,           lat: 40.7703, lng: -73.9384 },
  { content: 'LIC is all glass towers now but the water views are still free and still perfect',               pen_name: null,           lat: 40.7465, lng: -73.9548 },
  { content: 'met someone who has lived on this street for 40 years. asked if the city felt different. it does.', pen_name: 'GhostFreq', lat: 40.7491, lng: -73.9502 },
  { content: 'the 7 train at rush hour is a full cultural immersion experience i recommend to everyone',       pen_name: 'NeonEcho',     lat: 40.7448, lng: -73.9478 },
  { content: 'flushing main street at night is the most alive place on earth i am completely convinced',       pen_name: null,           lat: 40.7596, lng: -73.8328 },

  // ── Lower East Side ───────────────────────────────────────────────────────────────
  { content: 'this street smells like 2007 and a very questionable decision',                                   pen_name: null,           lat: 40.7229, lng: -73.9832 },
  { content: 'the last real dive bar on orchard just announced it is closing and i am not okay',               pen_name: 'VoidDrifter',  lat: 40.7198, lng: -73.9901 },
  { content: 'found a jazz club two blocks from my apartment that i somehow never knew existed',               pen_name: null,           lat: 40.7172, lng: -73.9863 },
  { content: 'gentrification is loud tonight. still hear the old neighborhood underneath if you listen.',      pen_name: 'GlitchWalker', lat: 40.7218, lng: -73.9853 },
  { content: 'whoever runs the dumpling counter on eldridge — thank you. genuinely from the heart.',          pen_name: null,           lat: 40.7149, lng: -73.9882 },
  { content: 'this whole neighborhood used to be something else and is still becoming something new',          pen_name: 'LiminalTrace', lat: 40.7203, lng: -73.9921 },
  { content: '3am and the noodle shop is completely packed. as it should be.',                                 pen_name: null,           lat: 40.7181, lng: -73.9843 },
  { content: 'the street art in this alley changes every week. it is a living timeline.',                      pen_name: null,           lat: 40.7234, lng: -73.9876 },
  { content: 'someone spray painted stay weird on this wall and i took it personally in the best way',         pen_name: 'PhaseShift',   lat: 40.7163, lng: -73.9912 },
  { content: 'Essex Market is genuinely the best thing to happen to this block in years',                      pen_name: null,           lat: 40.7192, lng: -73.9867 },
  { content: 'old punk venue is a juice bar now. the feelings i have about this are complicated.',             pen_name: 'ObsidianNomad',lat: 40.7210, lng: -73.9894 },
  { content: 'found the most beautiful fire escape garden. made eye contact with the gardener. kept walking.', pen_name: null,           lat: 40.7155, lng: -73.9938 },
  { content: 'the energy on delancey at midnight is genuinely unclassifiable',                                 pen_name: null,           lat: 40.7223, lng: -73.9844 },
  { content: 'every block down here has a story from a different decade all layered on top of each other',    pen_name: 'WiredSpecter', lat: 40.7177, lng: -73.9924 },
  { content: 'someone is blasting salsa from their window and the whole street is better for it',             pen_name: null,           lat: 40.7196, lng: -73.9849 },

  // ── Financial District ────────────────────────────────────────────────────────────
  { content: 'the charging bull is smaller than i imagined and surrounded by tourists at all hours',           pen_name: null,           lat: 40.7069, lng: -74.0089 },
  { content: 'wall street at 9pm is quieter than prospect park at noon. genuinely unsettling.',               pen_name: 'VoidDrifter',  lat: 40.7088, lng: -74.0062 },
  { content: 'found a deli down here that feels like it exists completely outside of time',                    pen_name: null,           lat: 40.7041, lng: -74.0121 },
  { content: 'the subway violinist at fulton has been playing the same song for two hours. he is winning.',   pen_name: null,           lat: 40.7082, lng: -74.0036 },
  { content: 'every suit i see down here looks like a costume and then i remember i am wearing one too',      pen_name: 'WiredSpecter', lat: 40.7075, lng: -74.0141 },
  { content: 'stone street happy hour and everyone slowly remembers they are a person',                       pen_name: null,           lat: 40.7055, lng: -74.0095 },
  { content: 'the freedom tower lobby has a gift shop and i have a lot of feelings about that',               pen_name: null,           lat: 40.7096, lng: -74.0108 },
  { content: 'broadway down here at noon is chaos and i am completely here for every second of it',           pen_name: 'LiminalTrace', lat: 40.7063, lng: -74.0072 },
  { content: 'found a tiny park wedged between two buildings that nobody else seems to know exists',           pen_name: null,           lat: 40.7110, lng: -74.0079 },
  { content: 'watching the ferries from the waterfront. this is the only pace of life that makes sense.',    pen_name: null,           lat: 40.7093, lng: -74.0157 },

  // ── Scattered ─────────────────────────────────────────────────────────────────────
  { content: 'the brooklyn bridge pedestrian lane at sunrise is the best free thing in new york',              pen_name: null,           lat: 40.7061, lng: -73.9969 },
  { content: 'times square at 4am is peaceful and genuinely surreal. i recommend it exactly once.',           pen_name: 'FaintSignal',  lat: 40.7580, lng: -73.9855 },
  { content: 'the high line at dusk. nothing else needs to happen today. this is enough.',                    pen_name: null,           lat: 40.7480, lng: -74.0048 },
  { content: 'chinatown on a sunday afternoon is the most alive corner of manhattan fight me',                pen_name: 'CrypticTide',  lat: 40.7157, lng: -73.9970 },
  { content: 'staten island ferry is free and the skyline from the water is priceless. do it.',              pen_name: null,           lat: 40.6989, lng: -74.0158 },
]

const NEIGHBORHOODS = [
  { name: "Hell's Kitchen", count: 15 },
  { name: 'Central Park',   count: 12 },
  { name: 'Williamsburg',   count: 15 },
  { name: 'Queens',         count: 13 },
  { name: 'LES',            count: 15 },
  { name: 'FiDi',           count: 10 },
  { name: 'Scattered',      count:  5 },
]

async function seed() {
  console.log('Clearing all seed data…')
  const { error: delErr } = await supabase.from('thots').delete().in('session_id', ALL_SEED_IDS)
  if (delErr) console.warn('Warning — could not clear seed data:', delErr.message)
  else console.log('✓ Cleared\n')

  console.log(`Seeding ${THOTS.length} demo thots across NYC…\n`)

  const now = Date.now()

  const rows = THOTS.map((t, i) => {
    const session_id = `${DEMO_PREFIX}${String(i).padStart(12, '0')}`
    const ip_hash = createHash('sha256').update(`demo-${i}${IP_SALT}`).digest('hex')
    // Spread created_at across the last ~2 hours (96s apart)
    const createdAt = new Date(now - i * 96 * 1000)
    // Auth users (pen_name) → permanent; anon → 3h from creation
    const expiresAt = t.pen_name
      ? PERMANENT
      : new Date(createdAt.getTime() + 3 * 3600 * 1000).toISOString()
    return {
      content: t.content,
      pen_name: t.pen_name,
      session_id,
      ip_hash,
      location: `SRID=4326;POINT(${t.lng} ${t.lat})`,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt,
    }
  })

  const { data, error } = await supabase.from('thots').insert(rows).select('id, content, pen_name')

  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }

  let offset = 0
  console.log(`✓ Inserted ${data.length} thots:\n`)
  NEIGHBORHOODS.forEach(({ name, count }) => {
    const slice = data.slice(offset, offset + count)
    const named = slice.filter(t => t.pen_name).length
    console.log(`  ${name.padEnd(16)} ${count} thots  (${named} named, ${count - named} anon)`)
    offset += count
  })
}

seed()
