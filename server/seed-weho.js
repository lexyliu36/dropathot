/**
 * Demo seed — 75 thots across West Hollywood and surrounding areas.
 * Coordinates cover Santa Monica Blvd, Sunset Strip, Melrose, Design District, and edges into Beverly Hills / Silver Lake.
 *
 * Usage:  node --env-file=server/.env server/seed-weho.js
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const IP_SALT     = process.env.IP_SALT ?? 'dev'
const WEHO_PREFIX = 'c0000000-0000-0000-0000-'
const FAR_FUTURE = new Date(Date.now() + 100 * 365.25 * 24 * 3600 * 1000).toISOString()

const THOTS = [
  // ── Santa Monica Blvd (Boys Town) ─────────────────────────────────────────────
  { content: 'the abbey on a thursday is peak chaos in the best possible way',                                 pen_name: 'NightCrawler_WH', lat: 34.0901, lng: -118.3637 },
  { content: 'santa monica blvd at 1am and somehow everyone is still going',                                  pen_name: 'LateNightLA',              lat: 34.0903, lng: -118.3700 },
  { content: 'pride flags on every block year round. this is what commitment looks like.',                    pen_name: 'AlwaysPride',     lat: 34.0897, lng: -118.3760 },
  { content: 'the gym on santa monica has mirror lighting that makes everyone look like gods. intentional.',  pen_name: 'MirrorCheck',     lat: 34.0893, lng: -118.3820 },
  { content: 'brunch here starts at noon and ends sometime tuesday. no one keeps track.',                     pen_name: 'BrunchForever',              lat: 34.0907, lng: -118.3862 },
  { content: 'i moved here from ohio three years ago and i never once thought about going back',              pen_name: 'OhioNoMore',      lat: 34.0899, lng: -118.3780 },
  { content: 'the drag show tipped me $5 back. we love an inverted economy.',                                 pen_name: 'TippedBack',      lat: 34.0910, lng: -118.3710 },

  // ── Sunset Strip ──────────────────────────────────────────────────────────────
  { content: 'sunset strip at golden hour. the billboards are bigger than most towns i have lived in.',       pen_name: 'BillboardBoy',    lat: 34.0983, lng: -118.3816 },
  { content: 'the troubadour door still feels like something important might happen inside',                  pen_name: 'VenueGhost',      lat: 34.0800, lng: -118.3873 },
  { content: 'roxy theatre queue at 10pm. people who look like they know things.',                            pen_name: 'GlitchWalker',    lat: 34.0981, lng: -118.3880 },
  { content: 'you can see the city grid from the strip at night. sixty years of neon dreams.',               pen_name: 'NeonEcho',        lat: 34.0975, lng: -118.3850 },
  { content: 'comedy store on a tuesday. the crowd is 40 people and three working actors.',                   pen_name: 'ComedyStore_rat', lat: 34.0967, lng: -118.3819 },
  { content: 'chateau marmont vibes from the street. one day. probably not.',                                 pen_name: 'ChateauDreamer',              lat: 34.0998, lng: -118.3835 },
  { content: 'whisky a go go still matters. rock and roll is not dead it just lives in weho.',               pen_name: 'NotDeadYet_Rock', lat: 34.0989, lng: -118.3856 },

  // ── Melrose Ave ───────────────────────────────────────────────────────────────
  { content: 'the pink wall is the most photographed surface in the western hemisphere. adjust accordingly.', pen_name: 'PinkWallKnows',   lat: 34.0835, lng: -118.3688 },
  { content: 'melrose vintage shops: six racks of things i cannot afford and one perfect jacket',             pen_name: 'VintageFever',    lat: 34.0839, lng: -118.3745 },
  { content: 'paul smith store. everything is expensive. the rose wall outside is free.',                    pen_name: 'RoseWallOnly',              lat: 34.0840, lng: -118.3712 },
  { content: 'lunch at a melrose patio. watched two people be recognized. nobody flinched.',                 pen_name: 'Unfazed_LA',      lat: 34.0836, lng: -118.3780 },
  { content: 'the energy on melrose at 11am is chaotic and ambitious in equal measure',                      pen_name: 'PhaseShift',      lat: 34.0832, lng: -118.3660 },
  { content: 'street style on melrose is a full-time performance and everyone is a willing participant',      pen_name: 'MelroseDaily',              lat: 34.0841, lng: -118.3720 },

  // ── Design District / Robertson Blvd ──────────────────────────────────────────
  { content: 'ivy restaurant patio. every table is a scene. every scene is a pilot.',                        pen_name: 'IvyWatcher',      lat: 34.0790, lng: -118.3828 },
  { content: 'robertson blvd at 2pm. three sprinter vans, one closed set, zero context.',                    pen_name: 'SprinterSeason',  lat: 34.0800, lng: -118.3846 },
  { content: 'design district on a weekday. quieter. better. the real ones are here.',                       pen_name: 'WeekdayWalker',   lat: 34.0778, lng: -118.3801 },
  { content: 'the chairs at fred segal cost more than my rent and they are incredible',                      pen_name: 'FredSegalFan',              lat: 34.0811, lng: -118.3863 },

  // ── West Hollywood Park / Plummer Park ────────────────────────────────────────
  { content: 'west hollywood park at noon. pickleball, yoga, and six different conversations happening.',     pen_name: 'ParkObserver',    lat: 34.0912, lng: -118.3616 },
  { content: 'plummer park chess tables. old men, good games, zero talking.',                                pen_name: 'ChessParker',     lat: 34.0961, lng: -118.3624 },
  { content: 'the farmers market here saturdays hits the same every single week',                            pen_name: 'SaturdayMkt_WH',              lat: 34.0915, lng: -118.3620 },
  { content: 'dog park at 8am. more social than any bar i have been to in this city.',                       pen_name: 'DogParkDave',     lat: 34.0908, lng: -118.3598 },

  // ── Laurel Canyon / Holloway ──────────────────────────────────────────────────
  { content: 'laurel canyon feels like a different decade. every house has a guitar story.',                  pen_name: 'CanyonDrifter',   lat: 34.1002, lng: -118.3765 },
  { content: 'hiking at dawn above the canyon. LA below you, silent for once.',                              pen_name: 'LiminalTrace',    lat: 34.1025, lng: -118.3789 },
  { content: 'the canyon store is the kind of place you go for one thing and stay for forty minutes',        pen_name: 'CanyonStoreKid',              lat: 34.1003, lng: -118.3748 },
  { content: 'met a musician at the canyon club who had six songs on shows i loved. just at a bar.',         pen_name: 'FanMoment_LA',    lat: 34.1004, lng: -118.3755 },

  // ── Santa Monica Blvd West / Beverly Hills edge ────────────────────────────────
  { content: 'the border between weho and beverly hills is a vibe shift. you feel it.',                      pen_name: 'BorderCrosser',   lat: 34.0772, lng: -118.3930 },
  { content: 'beverly hills adjacent means you can see the fancy from here. that is enough.',                pen_name: 'BHAdjacent',              lat: 34.0780, lng: -118.3960 },
  { content: 'rodeo drive is one mile away and i have never once walked it. perfectly happy about this.',    pen_name: 'RodeoSkipper',    lat: 34.0760, lng: -118.3900 },

  // ── Fairfax / East WeHo edge ──────────────────────────────────────────────────
  { content: 'fairfax at melrose. the intersection of hype and hunger. always a line somewhere.',             pen_name: 'LineStander99',   lat: 34.0836, lng: -118.3610 },
  { content: 'supreme drop days. the line starts tuesday. the drop is friday. nobody sleeps.',               pen_name: 'DropDayVet',      lat: 34.0832, lng: -118.3598 },
  { content: 'the farmer\'s market og on fairfax. tourists and locals and nobody fighting about it.',        pen_name: 'FarmersMktFan',   lat: 34.0766, lng: -118.3595 },
  { content: 'canter\'s deli at 2am. every booth is a novel. nobody is in bed.',                             pen_name: 'CantersDave',     lat: 34.0752, lng: -118.3614 },

  // ── Nightlife corridor ─────────────────────────────────────────────────────────
  { content: 'rage nightclub at midnight. the bass is a second heartbeat.',                                   pen_name: 'RageFloor',              lat: 34.0906, lng: -118.3643 },
  { content: 'micky\'s has been here since before i was born. legacy institution.',                          pen_name: 'WeHoHistorian',   lat: 34.0904, lng: -118.3657 },
  { content: 'after-hours taco stand outside a bar. greatest food invention ever created.',                  pen_name: 'TacoAfterHours',  lat: 34.0899, lng: -118.3680 },
  { content: 'the uber pool at 2am picks up six different parties. everyone compares notes.',                pen_name: 'UberPhilosopher', lat: 34.0908, lng: -118.3750 },
  { content: 'someone famous walked past. nobody reacted. this city has trained us well.',                   pen_name: 'Unfazed_WeHo',              lat: 34.0912, lng: -118.3700 },

  // ── Gym / Spa / Wellness culture ──────────────────────────────────────────────
  { content: 'equinox at 6am. motivated, terrifying, beautiful. all in one room.',                           pen_name: 'EarlyRiser_WH',   lat: 34.0884, lng: -118.3731 },
  { content: 'cold plunge at a weho spa. first time: screaming. every time after: transcendence.',           pen_name: 'IceAddict',       lat: 34.0870, lng: -118.3820 },
  { content: 'the juice bar that costs $18 a drink and you keep going back. we all do.',                     pen_name: 'JuiceBarAddict',              lat: 34.0875, lng: -118.3790 },

  // ── Comedy / Culture ──────────────────────────────────────────────────────────
  { content: 'groundlings show on a saturday. ten people who will be famous in three years.',                pen_name: 'GroundlingFan',   lat: 34.0826, lng: -118.3703 },
  { content: 'largo at the coronet. best small music venue in this entire city. not debatable.',             pen_name: 'LargoLifer',      lat: 34.0831, lng: -118.3654 },

  // ── East / Silver Lake edge ────────────────────────────────────────────────────
  { content: 'silver lake reservoir loop at sunrise. the hills, the water, the coffee shop after.',         pen_name: 'ReservoirRunner', lat: 34.0888, lng: -118.2795 },
  { content: 'sunset junction at dusk. boutiques, tacos, dogs, musicians. peak LA moment.',                 pen_name: 'SunsetJunction',  lat: 34.0875, lng: -118.2780 },
  { content: 'the intelligentsia on sunset. third wave coffee and people with good coats.',                  pen_name: 'CoffeeSnobLA',    lat: 34.0868, lng: -118.2817 },
  { content: 'echo park lake. complicated feelings. still beautiful. people remember.',                      pen_name: 'EchoPark_local',  lat: 34.0776, lng: -118.2601 },

  // ── Hollywood Hills / Canyon Overlooks ────────────────────────────────────────
  { content: 'runyon canyon at 7am. every fitness level, every dog breed, one shared mission.',              pen_name: 'RunyonRegular',   lat: 34.1050, lng: -118.3503 },
  { content: 'the city from mulholland at night is not real. it is a screensaver.',                          pen_name: 'MulhollandDave',  lat: 34.1161, lng: -118.3670 },
  { content: 'griffith park observatory from a distance. it never stops being iconic.',                      pen_name: 'GriffithGazer',              lat: 34.1184, lng: -118.3004 },
  { content: 'hiking above los feliz at dusk. the city grid below like a circuit board.',                    pen_name: 'GridWatcher',     lat: 34.1066, lng: -118.2851 },

  // ── Mid-City / Koreatown edge ─────────────────────────────────────────────────
  { content: 'korean bbq at midnight in ktown with people i met two hours ago. this is friendship.',        pen_name: 'KtownKing',       lat: 34.0615, lng: -118.3007 },
  { content: 'the line hotel rooftop. looking west toward weho. the city is enormous and gorgeous.',        pen_name: 'RooftopPhil',     lat: 34.0601, lng: -118.3003 },
  { content: 'wilshire blvd at rush hour. sixteen lanes of collective reckoning.',                          pen_name: 'WilshireHour',              lat: 34.0617, lng: -118.3100 },

  // ── Los Feliz / Franklin corridor ─────────────────────────────────────────────
  { content: 'los feliz on a sunday morning. bookstores, bagels, zero urgency.',                             pen_name: 'LosFelizSlow',    lat: 34.1073, lng: -118.2908 },
  { content: 'vista theatre still plays films on a single screen like it is 1923. perfect.',                pen_name: 'SingleScreenFan', lat: 34.1060, lng: -118.2920 },
  { content: 'franklin village at 9pm. small, walkable, the most european block in la.',                    pen_name: 'FranklinWalker',  lat: 34.1071, lng: -118.2972 },

  // ── Random / atmospheric ──────────────────────────────────────────────────────
  { content: 'someone left a handwritten setlist taped to a telephone pole. kept it.',                       pen_name: 'SetlistKeeper',              lat: 34.0918, lng: -118.3660 },
  { content: 'the palm trees on santa monica at dusk are genuinely impossible to describe accurately',       pen_name: 'PalmTreeMoment',  lat: 34.0900, lng: -118.3730 },
  { content: 'a coyote just crossed in front of me on a residential block. weho nature walk.',               pen_name: 'CoyoteWatcher',   lat: 34.0945, lng: -118.3620 },
  { content: 'every season here looks like the good season. this is both a gift and a curse.',               pen_name: 'EternalSummer',              lat: 34.0880, lng: -118.3790 },
  { content: 'window table at a restaurant on santa monica. watched four potential auditions walk by.',      pen_name: 'WindowSeat_WH',   lat: 34.0896, lng: -118.3810 },
  { content: 'the energy at 11pm on a friday here could power a small country',                              pen_name: 'EnergyObserver',  lat: 34.0905, lng: -118.3680 },
  { content: 'two people proposed tonight within one block of each other. separately. this city.',           pen_name: 'ProposalWitness',              lat: 34.0901, lng: -118.3750 },
]

const AREAS = [
  { name: 'Boys Town / SM Blvd',   count: 7  },
  { name: 'Sunset Strip',          count: 7  },
  { name: 'Melrose Ave',           count: 6  },
  { name: 'Design District',       count: 4  },
  { name: 'Parks',                 count: 4  },
  { name: 'Laurel Canyon',         count: 4  },
  { name: 'Fairfax / East edge',   count: 4  },
  { name: 'Nightlife',             count: 5  },
  { name: 'Wellness',              count: 3  },
  { name: 'Comedy / Culture',      count: 2  },
  { name: 'Silver Lake edge',      count: 4  },
  { name: 'Hills / Overlooks',     count: 4  },
  { name: 'Mid-City / Ktown',      count: 3  },
  { name: 'Los Feliz',             count: 3  },
  { name: 'Atmospheric',           count: 7  },
]

async function seed() {
  console.log('Clearing WeHo seed data…')
  const wehoIds = Array.from({ length: 85 }, (_, i) => `${WEHO_PREFIX}${String(i).padStart(12, '0')}`)
  const { error: delErr } = await supabase.from('thots').delete().in('session_id', wehoIds)
  if (delErr) console.warn('Warning — could not clear WeHo seed data:', delErr.message)
  else console.log('✓ Cleared\n')

  console.log(`Seeding ${THOTS.length} thots across West Hollywood…\n`)

  const now = Date.now()
  const rows = THOTS.map((t, i) => ({
    content:    t.content,
    pen_name:   t.pen_name,
    session_id: `${WEHO_PREFIX}${String(i).padStart(12, '0')}`,
    ip_hash:    createHash('sha256').update(`weho-${i}${IP_SALT}`).digest('hex'),
    location:   `SRID=4326;POINT(${t.lng} ${t.lat})`,
    created_at: new Date(now - i * 90 * 1000).toISOString(),
    expires_at: FAR_FUTURE,
    is_seed:    true,
    hidden:     true,
  }))

  const { data, error } = await supabase.from('thots').insert(rows).select('id')
  if (error) { console.error('Seed failed:', error.message); process.exit(1) }

  console.log(`✓ Inserted ${data.length} thots:\n`)
  AREAS.forEach(({ name, count }) => console.log(`  ${name.padEnd(24)} ${count} thots`))
}

seed()
