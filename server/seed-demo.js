/**
 * Demo seed — 85 thots spread across all 5 NYC boroughs + Jersey City / Hoboken.
 * Coordinates are intentionally spaced so pins don't overlap at city-scale zoom.
 *
 * Usage:  node --env-file=.env seed-demo.js
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { ALL_SEED_IDS } from './lib/seed-ids.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const IP_SALT    = process.env.IP_SALT ?? 'dev'
const DEMO_PREFIX = 'b0000000-0000-0000-0000-'
const SEVEN_DAYS  = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

const THOTS = [
  // ── Manhattan: Upper West Side ──────────────────────────────────────────────────
  { content: 'riverside park at sunset and the hudson goes completely gold',                                    pen_name: 'hotdog4ever',    lat: 40.8014, lng: -73.9717 },
  { content: 'the 1 train skips logic sometimes and i have made peace with that',                              pen_name: 'TrainGremlin',   lat: 40.7876, lng: -73.9802 },
  { content: 'zabar\'s on a saturday morning is the closest thing this city has to a town square',             pen_name: 'BagelsOrDeath',  lat: 40.7834, lng: -73.9831 },

  // ── Manhattan: Harlem ────────────────────────────────────────────────────────────
  { content: 'marcus garvey park at noon. chess, drums, and the best jerk chicken smell in the city.',        pen_name: 'VoidDrifter',   lat: 40.8060, lng: -73.9446 },
  { content: 'the apollo theater marquee still hits different every single time i walk past it',               pen_name: 'Uptown_lurker',  lat: 40.8100, lng: -73.9499 },
  { content: '125th on a friday afternoon is the realest block in manhattan. no debate.',                     pen_name: 'no_cap_harlem',  lat: 40.8084, lng: -73.9478 },

  // ── Manhattan: Washington Heights ───────────────────────────────────────────────
  { content: 'fort tryon park hides the best view of the hudson and nobody tells tourists',                    pen_name: 'DominicanDad99', lat: 40.8597, lng: -73.9321 },
  { content: 'dominican spot on 181st that has existed since forever. long may it run.',                      pen_name: 'MoistMom',       lat: 40.8490, lng: -73.9393 },

  // ── Manhattan: Upper East Side ───────────────────────────────────────────────────
  { content: 'museum mile on a friday evening when it\'s free and everyone suddenly has culture',              pen_name: 'GhostFreq',     lat: 40.7794, lng: -73.9632 },
  { content: 'carl schurz park is quieter than central park and 10x better for that exact reason',            pen_name: 'quietdog88',      lat: 40.7762, lng: -73.9452 },

  // ── Manhattan: Midtown ───────────────────────────────────────────────────────────
  { content: 'grand central at rush hour is a ballet that nobody rehearsed',                                   pen_name: 'ConcoursePhantom', lat: 40.7527, lng: -73.9772 },
  { content: 'the top of the rock at 9pm with no clouds. i owe this city an apology for every bad thing i said.', pen_name: 'LiminalTrace', lat: 40.7588, lng: -73.9798 },
  { content: 'bryant park in december is corny as hell and i love every second of it',                         pen_name: 'CornyAndProud',  lat: 40.7536, lng: -73.9832 },

  // ── Manhattan: Chelsea / Hell's Kitchen ─────────────────────────────────────────
  { content: 'the high line at dusk. slow down. this is what cities are for.',                                 pen_name: 'VoidDrifter',   lat: 40.7480, lng: -74.0048 },
  { content: 'chelsea market on a tuesday when the crowds thin out is actually great',                         pen_name: 'TuesdayEnergy',  lat: 40.7423, lng: -74.0059 },

  // ── Manhattan: Greenwich Village / West Village ──────────────────────────────────
  { content: 'the corner of bleecker and perry looks like a film set at all times. they know.',               pen_name: 'CrypticTide',   lat: 40.7339, lng: -74.0047 },
  { content: 'smalls jazz club at midnight. three tourists, forty regulars, one god.',                        pen_name: 'WiredSpecter',  lat: 40.7317, lng: -74.0023 },
  { content: 'washington square park at every hour is a completely different park',                            pen_name: 'pigeonwatcher',  lat: 40.7308, lng: -73.9973 },

  // ── Manhattan: East Village / Lower East Side ────────────────────────────────────
  { content: 'tompkins square park at 8am. pigeons, dogs, ghosts of the 80s.',                               pen_name: 'GhostFreq',     lat: 40.7264, lng: -73.9815 },
  { content: 'the old punk venue is a juice bar now. i have complicated feelings about this.',                pen_name: 'AngryKombucha',  lat: 40.7210, lng: -73.9894 },
  { content: 'found a jazz club two blocks from my apartment that i never knew existed',                      pen_name: 'NeonEcho',      lat: 40.7172, lng: -73.9863 },

  // ── Manhattan: Chinatown / Tribeca ───────────────────────────────────────────────
  { content: 'chinatown on a sunday morning before 9am belongs to people who are actually from here',         pen_name: 'dim_sum_spy',    lat: 40.7157, lng: -73.9970 },
  { content: 'the canal street fish market smell is unbearable and somehow nostalgic',                        pen_name: 'FishMarketFred', lat: 40.7185, lng: -74.0007 },
  { content: 'tribeca loft party energy at 11pm. everyone looks like money smells like secrets.',             pen_name: 'RichVibes99',    lat: 40.7163, lng: -74.0086 },

  // ── Manhattan: Financial District ────────────────────────────────────────────────
  { content: 'wall street at 9pm is quieter than prospect park at noon. unsettling.',                        pen_name: 'PhaseShift',    lat: 40.7074, lng: -74.0113 },
  { content: 'the 9/11 pools at sunrise. just go alone. bring nothing.',                                     pen_name: 'AloneTime2024',  lat: 40.7115, lng: -74.0132 },
  { content: 'staten island ferry is free and the skyline view from the water is priceless. do the thing.',  pen_name: 'FerryMaximalist', lat: 40.6996, lng: -74.0172 },

  // ── Brooklyn: DUMBO / Brooklyn Heights ───────────────────────────────────────────
  { content: 'the view from brooklyn bridge park pier 1 is why people move here and never leave',             pen_name: 'ObsidianNomad', lat: 40.6996, lng: -73.9968 },
  { content: 'dumbo on a weekday morning before the instagrammers arrive is genuinely magical',               pen_name: 'early_riser_bk', lat: 40.7033, lng: -73.9884 },
  { content: 'brooklyn heights promenade at golden hour. manhattan across the water. nothing else needed.',   pen_name: 'GoldenHourGuy',  lat: 40.6960, lng: -73.9974 },

  // ── Brooklyn: Williamsburg ───────────────────────────────────────────────────────
  { content: 'the mural on bedford changed again. still excellent. every time.',                              pen_name: 'NeonEcho',      lat: 40.7143, lng: -73.9626 },
  { content: 'rooftop party down the block. did not get invited. the music is great from here honestly.',    pen_name: 'Uninvited_King', lat: 40.7188, lng: -73.9556 },
  { content: 'vintage shop on north 7th has a jacket that contains my entire personality',                    pen_name: 'GlitchWalker',  lat: 40.7225, lng: -73.9508 },

  // ── Brooklyn: Bushwick ───────────────────────────────────────────────────────────
  { content: 'the bushwick collective walls just got updated. every block is a gallery now.',                 pen_name: 'VoidDrifter',   lat: 40.6940, lng: -73.9160 },
  { content: 'warehouse show at midnight. four rooms, three genres, zero VIP sections. perfect.',            pen_name: 'Rave_Mom',       lat: 40.6970, lng: -73.9089 },

  // ── Brooklyn: Park Slope / Prospect Park ─────────────────────────────────────────
  { content: 'prospect park lake at 7am. only dogs and the extremely committed.',                             pen_name: 'dog_dad_energy', lat: 40.6602, lng: -73.9690 },
  { content: 'fifth avenue park slope is the most functional block in brooklyn and i stand by that',         pen_name: 'WiredSpecter',  lat: 40.6728, lng: -73.9775 },
  { content: 'the botanic garden in april makes you believe in something again',                              pen_name: 'SeasonalFeeler', lat: 40.6694, lng: -73.9629 },

  // ── Brooklyn: Crown Heights / Bed-Stuy ───────────────────────────────────────────
  { content: 'bed stuy brownstones on a summer evening with every stoop occupied. the best.',                pen_name: 'StoopdogBK',     lat: 40.6872, lng: -73.9418 },
  { content: 'crown heights carnival energy even on a random tuesday. this neighborhood does not stop.',     pen_name: 'FaintSignal',   lat: 40.6707, lng: -73.9432 },

  // ── Brooklyn: Flatbush / Midwood ─────────────────────────────────────────────────
  { content: 'flatbush ave at noon is a world unto itself. everyone is somewhere important.',                 pen_name: 'busy_bee_bk',    lat: 40.6449, lng: -73.9583 },
  { content: 'di fara pizza is a 45 minute wait and the correct answer is yes every time',                   pen_name: 'PizzaPurist',    lat: 40.6251, lng: -73.9614 },

  // ── Brooklyn: Sunset Park / Bay Ridge ────────────────────────────────────────────
  { content: 'sunset park actually has the best sunset views in brooklyn and nobody talks about it enough',  pen_name: 'SunsetSnob99',   lat: 40.6508, lng: -74.0035 },
  { content: 'bay ridge on a sunday feels like a different city. slower. better somehow.',                   pen_name: 'BayRidgeDad',    lat: 40.6350, lng: -74.0280 },

  // ── Brooklyn: Coney Island / Brighton Beach ───────────────────────────────────────
  { content: 'coney island boardwalk off season is the most poetic place in new york city',                  pen_name: 'OffSeasonPoet',  lat: 40.5749, lng: -73.9850 },
  { content: 'brighton beach. russian grandmas, the ocean, borscht. all in one block. stunning.',            pen_name: 'borscht_boy',    lat: 40.5772, lng: -73.9614 },

  // ── Queens: Long Island City ──────────────────────────────────────────────────────
  { content: 'MoMA PS1 courtyard on a summer weekend. culture is alive out here.',                           pen_name: 'ArtHoe4Life',    lat: 40.7447, lng: -73.9485 },
  { content: 'LIC waterfront at dusk. manhattan across the water. everything feels possible.',               pen_name: 'LIC_Dreamer',    lat: 40.7465, lng: -73.9548 },

  // ── Queens: Astoria ──────────────────────────────────────────────────────────────
  { content: 'astoria park at sunrise belongs to swimmers and the extremely optimistic',                      pen_name: 'GhostFreq',     lat: 40.7793, lng: -73.9271 },
  { content: 'the gyro place on ditmars has been perfect for 20 years and will be perfect for 20 more',     pen_name: 'GyroOrDie',      lat: 40.7716, lng: -73.9346 },
  { content: 'a yia yia just handed me spanakopita through her window. this is why i live here.',            pen_name: 'blessed_by_yiayia', lat: 40.7684, lng: -73.9373 },

  // ── Queens: Jackson Heights / Flushing ────────────────────────────────────────────
  { content: 'jackson heights has food from every country and costs a fraction of manhattan. just saying.',  pen_name: 'cheap_eats_only', lat: 40.7498, lng: -73.8912 },
  { content: 'the 7 train is a cultural immersion experience i recommend to absolutely everyone',            pen_name: 'SevenTrainPhil', lat: 40.7448, lng: -73.9478 },
  { content: 'flushing main street at night is the most alive corner of this entire city. full stop.',      pen_name: 'VoidDrifter',   lat: 40.7596, lng: -73.8328 },

  // ── Queens: Forest Hills / Jamaica ────────────────────────────────────────────────
  { content: 'forest hills gardens looks like someone imported an english village and forgot to tell anyone', pen_name: 'BritishAccident', lat: 40.7186, lng: -73.8458 },
  { content: 'airtrain at 5am. everyone going somewhere. nobody talking. perfect collective silence.',       pen_name: 'CrypticTide',   lat: 40.6921, lng: -73.8057 },

  // ── Queens: Rockaway Beach ────────────────────────────────────────────────────────
  { content: 'rockaway beach in september when the summer people leave. the locals get their beach back.',   pen_name: 'LocalsOnly_RB',  lat: 40.5848, lng: -73.8459 },

  // ── The Bronx ────────────────────────────────────────────────────────────────────
  { content: 'the new york botanical garden in may is quietly one of the top five places in this city',     pen_name: 'PlantMomActual', lat: 40.8620, lng: -73.8772 },
  { content: 'yankee stadium before a night game. the whole neighborhood hums.',                             pen_name: 'BronxBomber_irl', lat: 40.8296, lng: -73.9262 },
  { content: 'arthur avenue is the real little italy. the manhattan one is for tourists.',                   pen_name: 'SundayGravy',    lat: 40.8506, lng: -73.8820 },
  { content: 'pelham bay park is bigger than central park and somehow almost nobody goes. good.',            pen_name: 'NeonEcho',      lat: 40.8690, lng: -73.8072 },
  { content: 'the bronx zoo on a random wednesday. barely anyone there. just you and the animals.',         pen_name: 'ZooCreep',       lat: 40.8506, lng: -73.8778 },

  // ── Staten Island ────────────────────────────────────────────────────────────────
  { content: 'snug harbor botanical garden. free. stunning. completely unknown to the rest of the city.',   pen_name: 'StatenIslandMom', lat: 40.6441, lng: -74.1012 },
  { content: 'the verrazano at night from the staten island side. that bridge is something else.',           pen_name: 'VerrazanoDave',  lat: 40.6065, lng: -74.0514 },
  { content: 'tottenville beach is the end of new york city. stands here long enough and you feel it.',     pen_name: 'edge_of_earth99', lat: 40.5122, lng: -74.2513 },

  // ── Jersey City / Hoboken ──────────────────────────────────────────────────────
  { content: 'liberty state park view of manhattan from jersey. honestly might be better from here.',       pen_name: 'JerseyDefender', lat: 40.7112, lng: -74.0550 },
  { content: 'hoboken waterfront at 7am. the skyline across the river. coffee. everything is okay.',        pen_name: 'hoboken_hopeful', lat: 40.7359, lng: -74.0289 },
  { content: 'grove street PATH station energy is unmatched. commuters with stories.',                      pen_name: 'PATHRider4Life', lat: 40.7196, lng: -74.0431 },

  // ── Scattered: bridges, airports, edge cases ──────────────────────────────────
  { content: 'walking across the brooklyn bridge at sunrise. worth doing at least once a year.',             pen_name: 'BridgeWalker7',  lat: 40.7061, lng: -73.9969 },
  { content: 'JFK terminal 4 at 3am. the city within the city. completely different laws apply.',           pen_name: 'RedEyeRick',     lat: 40.6413, lng: -73.7781 },
  { content: 'the RFK bridge walkway at dusk. queens on one side, the bronx on the other. the whole thing.', pen_name: 'BridgeGoblin',   lat: 40.7943, lng: -73.9196 },
  { content: 'pelham parkway at 6am. the bronx waking up before anyone gives it credit for it.',            pen_name: 'LiminalTrace',  lat: 40.8556, lng: -73.8680 },
  { content: 'dead horse bay is a real place in brooklyn and it has a beach made of old bottles. go.',      pen_name: 'BottleBeachBro', lat: 40.5885, lng: -73.9068 },
]

const AREAS = [
  { name: 'Manhattan (Upper)',    count: 10 },
  { name: 'Manhattan (Mid/Lower)',count: 16 },
  { name: 'Brooklyn (North)',     count: 9  },
  { name: 'Brooklyn (South)',     count: 8  },
  { name: 'Queens',               count: 10 },
  { name: 'The Bronx',            count: 5  },
  { name: 'Staten Island',        count: 3  },
  { name: 'NJ + Scattered',       count: 8  },
]


async function seed() {
  console.log('Clearing all seed data…')
  const { error: delErr } = await supabase.from('thots').delete().in('session_id', ALL_SEED_IDS)
  if (delErr) console.warn('Warning — could not clear seed data:', delErr.message)
  else console.log('✓ Cleared\n')

  console.log(`Seeding ${THOTS.length} demo thots across NYC + NJ…\n`)

  const now = Date.now()

  const rows = THOTS.map((t, i) => {
    const session_id = `${DEMO_PREFIX}${String(i).padStart(12, '0')}`
    const ip_hash    = createHash('sha256').update(`demo-${i}${IP_SALT}`).digest('hex')
    const createdAt  = new Date(now - i * 90 * 1000) // 90s apart
    return {
      content:    t.content,
      pen_name:   t.pen_name,
      session_id,
      ip_hash,
      location:   `SRID=4326;POINT(${t.lng} ${t.lat})`,
      created_at: createdAt.toISOString(),
      expires_at: SEVEN_DAYS,
      is_seed: true,
      hidden: true,
    }
  })

  const { data, error } = await supabase.from('thots').insert(rows).select('id')

  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }

  console.log(`✓ Inserted ${data.length} thots:\n`)
  AREAS.forEach(({ name, count }) => {
    console.log(`  ${name.padEnd(24)} ${count} thots`)
  })
}

async function updateNames() {
  console.log(`Updating pen names for ${THOTS.length} seed thots…`)
  let ok = 0, fail = 0
  for (let i = 0; i < THOTS.length; i++) {
    const session_id = `${DEMO_PREFIX}${String(i).padStart(12, '0')}`
    const { error } = await supabase
      .from('thots')
      .update({ pen_name: THOTS[i].pen_name })
      .eq('session_id', session_id)
    if (error) { console.warn(`  ✗ ${session_id}: ${error.message}`); fail++ }
    else ok++
  }
  console.log(`\n✓ Updated ${ok} pen names${fail ? `, ${fail} failed` : ''}`)
}

const mode = process.argv[2]
if (mode === '--update-names') updateNames()
else seed()
