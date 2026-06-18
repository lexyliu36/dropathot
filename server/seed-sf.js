/**
 * Demo seed — 75 thots across San Francisco neighborhoods.
 * Covers Castro, Mission, SOMA, North Beach, Haight, Hayes Valley, Embarcadero, Richmond, Sunset, and more.
 *
 * Usage:  node --env-file=server/.env server/seed-sf.js
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const IP_SALT   = process.env.IP_SALT ?? 'dev'
const SF_PREFIX = 'd0000000-0000-0000-0000-'
const SEVEN_DAYS = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

const THOTS = [
  // ── Castro ────────────────────────────────────────────────────────────────────
  { content: 'castro theatre marquee is up for another classic. this block never gets old.',                  pen_name: 'CastroTheatreFan', lat: 37.7626, lng: -122.4350 },
  { content: 'the rainbow crosswalk freshly repainted. feels intentional. it is.',                           pen_name: 'RainbowLocal',     lat: 37.7614, lng: -122.4346 },
  { content: 'twin peaks from the castro steps at dusk. the whole city unfolds.',                            pen_name: 'TwinPeaksDave',    lat: 37.7616, lng: -122.4387 },
  { content: 'caught a double feature at the castro. one film from 1952. time is fake.',                     pen_name: null,               lat: 37.7625, lng: -122.4351 },
  { content: 'sf pride energy in the castro at 7am before it starts. the calm before the magnificent.',     pen_name: 'PrideLocal',       lat: 37.7612, lng: -122.4340 },
  { content: 'uncle bernie\'s diner. regulars who have been here longer than me. proud to be new.',          pen_name: 'NewRegular_SF',    lat: 37.7608, lng: -122.4330 },

  // ── Mission District ──────────────────────────────────────────────────────────
  { content: 'dolores park on a saturday. every demographic in one hill. the city in miniature.',            pen_name: 'DoloresParkPhil',  lat: 37.7596, lng: -122.4269 },
  { content: 'mission burrito at 11pm. the tortilla is the size of my future.',                              pen_name: 'BurritoMaximalist', lat: 37.7571, lng: -122.4193 },
  { content: 'clarion alley murals got updated again. better than any gallery. free.',                       pen_name: 'AlleyArtLover',    lat: 37.7625, lng: -122.4197 },
  { content: '24th and mission at noon. this is the real san francisco that people move here for.',          pen_name: null,               lat: 37.7525, lng: -122.4184 },
  { content: 'tartine bread line at 5pm. the wait is real. so is the bread.',                                pen_name: 'TartineWaiter',    lat: 37.7614, lng: -122.4241 },
  { content: 'dandelion chocolate on valencia. small batch. enormous feelings.',                             pen_name: 'ChocolatePurist',  lat: 37.7652, lng: -122.4213 },
  { content: 'mission bar at 10pm. the jukebox is perfect. nobody is ironic about it.',                     pen_name: 'JukeboxGhost',     lat: 37.7634, lng: -122.4200 },
  { content: 'valencia street on a sunday: cyclists, brunch queues, and serious intentions.',                pen_name: null,               lat: 37.7669, lng: -122.4214 },

  // ── SoMa ──────────────────────────────────────────────────────────────────────
  { content: 'sfmoma late night friday. the art hits different when the tourists leave.',                    pen_name: 'LateNightMOMA',    lat: 37.7857, lng: -122.4011 },
  { content: 'the bay bridge from soma rooftop. every tech launch is an afterthought from up here.',        pen_name: 'RooftopPhil_SF',   lat: 37.7830, lng: -122.3968 },
  { content: 'folsom street at 8am before anyone claims it. a completely different energy.',                 pen_name: 'FolsomEarlyRiser', lat: 37.7794, lng: -122.4027 },
  { content: 'found a 70s jazz club hidden in a soma basement. no sign. just a door.',                      pen_name: 'VoidDrifter',      lat: 37.7805, lng: -122.4050 },

  // ── North Beach ───────────────────────────────────────────────────────────────
  { content: 'city lights bookstore at midnight. kerouac is in the walls.',                                  pen_name: 'BeatPoetFan',      lat: 37.7978, lng: -122.4066 },
  { content: 'vesuvio bar stool at 7pm. the entire history of san francisco is at the next table.',          pen_name: 'VesuvioBarfly',    lat: 37.7978, lng: -122.4065 },
  { content: 'coit tower at dawn. the bay below. complete silence. completely worth the walk.',              pen_name: 'CoitDawnClimber',  lat: 37.8024, lng: -122.4058 },
  { content: 'north beach bocce courts on a saturday. old italian men and their very real opinions.',        pen_name: 'BocceWatcher',     lat: 37.8010, lng: -122.4080 },
  { content: 'broadway at 10pm. comedy clubs, strip clubs, tourists. block of maximum ambiguity.',           pen_name: null,               lat: 37.7988, lng: -122.4063 },

  // ── Haight-Ashbury ────────────────────────────────────────────────────────────
  { content: 'haight street at 2pm. 1967 is alive in at least four shop windows.',                          pen_name: 'HaightHistorian',  lat: 37.7694, lng: -122.4476 },
  { content: 'golden gate park entrance at the panhandle. everyone is going somewhere slow.',               pen_name: null,               lat: 37.7704, lng: -122.4445 },
  { content: 'amoeba music. the last great record store. treat it accordingly.',                            pen_name: 'AmoebaForever',    lat: 37.7672, lng: -122.4319 },
  { content: 'buena vista park at 6am. fog, crows, the city below, zero other people.',                     pen_name: 'FogChaser',        lat: 37.7706, lng: -122.4434 },

  // ── Hayes Valley ──────────────────────────────────────────────────────────────
  { content: 'smitten ice cream made with liquid nitrogen. the physics are the point.',                     pen_name: 'NitrogenFan',      lat: 37.7762, lng: -122.4233 },
  { content: 'hayes valley at noon on a tuesday. the most pleasant street in sf. change my mind.',          pen_name: null,               lat: 37.7759, lng: -122.4225 },
  { content: 'nopa restaurant at 1am. the late night menu is better than most dinner menus.',               pen_name: 'NopaAtMidnight',   lat: 37.7760, lng: -122.4277 },
  { content: 'octavia blvd park. urban design that actually worked. we should study this.',                 pen_name: 'UrbanPlannerFan',  lat: 37.7756, lng: -122.4258 },

  // ── Embarcadero / Financial District ──────────────────────────────────────────
  { content: 'ferry building market tuesday. the cheese. the bread. the ferry behind it. perfect.',         pen_name: 'FerryBldgFan',     lat: 37.7956, lng: -122.3935 },
  { content: 'the bay at 6am from the embarcadero. alcatraz in the mist. nothing is real.',                pen_name: 'AlcatrazMist',     lat: 37.7988, lng: -122.3982 },
  { content: 'transamerica pyramid from the park. sf has weird beautiful taste in architecture.',           pen_name: 'PyramidGazer',     lat: 37.7952, lng: -122.4030 },
  { content: 'fisherman\'s wharf at 7am before the sea lions get an audience. just you and them.',          pen_name: null,               lat: 37.8083, lng: -122.4177 },
  { content: 'ina coolbrith park. nobody knows this place. go.',                                            pen_name: 'SecretSpotSF',     lat: 37.7987, lng: -122.4110 },

  // ── Richmond District ─────────────────────────────────────────────────────────
  { content: 'clement street on a saturday. the best dim sum outside of hong kong. proven.',               pen_name: 'ClementStreetFan', lat: 37.7826, lng: -122.4637 },
  { content: 'green apple books on clement. independent since 1967. probably forever.',                    pen_name: 'GreenAppleLifer',  lat: 37.7833, lng: -122.4648 },
  { content: 'lands end trail at sunset. the pacific on one side. nobody taking photos. just looking.',    pen_name: 'LandsEndWalker',   lat: 37.7793, lng: -122.5075 },
  { content: 'sutro baths ruins at high tide. the ocean pours in and it still feels like ruins.',          pen_name: null,               lat: 37.7801, lng: -122.5134 },
  { content: 'inner richmond at 10pm. dim sum restaurants still going. the lights, the steam, the noise.', pen_name: 'InnerRichmondNight', lat: 37.7805, lng: -122.4740 },

  // ── Sunset District ───────────────────────────────────────────────────────────
  { content: 'irving street sunset. the fog rolling in off the ocean at 4pm. every day. perfect.',         pen_name: 'FogRollsIn',       lat: 37.7633, lng: -122.4644 },
  { content: 'ocean beach at low tide. the city is invisible behind the dunes. this is still here.',       pen_name: 'OceanBeachSF',     lat: 37.7569, lng: -122.5108 },
  { content: 'judah street muni. the N line. west toward the ocean. always some kind of adventure.',       pen_name: null,               lat: 37.7637, lng: -122.4714 },
  { content: 'inner sunset brunch spot. the kind of place where the menu is written on a chalkboard.',    pen_name: 'ChalkboardMenu',   lat: 37.7641, lng: -122.4636 },

  // ── Noe Valley ────────────────────────────────────────────────────────────────
  { content: '24th street noe valley on a sunday. strollers, farmers market, impossible quietness.',        pen_name: 'NoeValleyLocal',   lat: 37.7512, lng: -122.4328 },
  { content: 'the church street hill. nobody talks about this view. everyone should.',                      pen_name: null,               lat: 37.7510, lng: -122.4280 },
  { content: 'noe valley gets afternoon sun when the rest of the city is in fog. they know.',              pen_name: 'SunPocketFan',     lat: 37.7506, lng: -122.4340 },

  // ── Bernal Heights ────────────────────────────────────────────────────────────
  { content: 'bernal heights hill at dusk. 360 degree san francisco. nobody is up here.',                  pen_name: 'BernalHillClimber', lat: 37.7440, lng: -122.4153 },
  { content: 'cortland ave. the neighborhood that hasn\'t become a brand yet. long may it run.',           pen_name: 'CortlandRegular',  lat: 37.7419, lng: -122.4152 },

  // ── Glen Park / Glen Canyon ────────────────────────────────────────────────────
  { content: 'glen canyon in the fog at 7am. a redwood forest inside the city. not kidding.',              pen_name: 'GlenCanyonKid',    lat: 37.7360, lng: -122.4388 },
  { content: 'glen park bart station. the BART plaza with the creek behind it. so strange. so good.',      pen_name: null,               lat: 37.7332, lng: -122.4342 },

  // ── Golden Gate Park ──────────────────────────────────────────────────────────
  { content: 'buffalo paddock in golden gate park. american bison. in san francisco. every single day.',   pen_name: 'BisonFan_SF',      lat: 37.7695, lng: -122.5010 },
  { content: 'ggp on a wednesday afternoon. just people and ducks. the city dissolves.',                   pen_name: null,               lat: 37.7694, lng: -122.4862 },
  { content: 'the conservatory of flowers is the most beautiful building in california. stand on this.',   pen_name: 'ConservatoryFan',  lat: 37.7718, lng: -122.4628 },
  { content: 'de young museum courtyard. the tower above, the park below, and just space.',               pen_name: 'DeYoungDreamer',   lat: 37.7714, lng: -122.4686 },

  // ── Presidio / Marina edge ────────────────────────────────────────────────────
  { content: 'golden gate bridge from baker beach. tourists take it from the overlook. locals know.',      pen_name: 'BakerBeachLocal',  lat: 37.7934, lng: -122.4836 },
  { content: 'the presidio at 6am. deer. fog. eucalyptus. it smells like another country.',               pen_name: 'PresidioRunner',   lat: 37.7975, lng: -122.4616 },
  { content: 'marina green at noon. kite festival energy even on regular days.',                           pen_name: null,               lat: 37.8039, lng: -122.4375 },
  { content: 'fort mason at dusk. the bay and marin across. this view is never not beautiful.',            pen_name: 'FortMasonVibes',   lat: 37.8056, lng: -122.4298 },

  // ── Tenderloin / Civic Center edge ────────────────────────────────────────────
  { content: 'davies symphony hall on a thursday. the tloin outside. the brahms inside. sf contains it all.', pen_name: 'DaviesHallFan', lat: 37.7774, lng: -122.4201 },
  { content: 'civic center at noon. public art, public everything. the complicated heart of the city.',    pen_name: null,               lat: 37.7793, lng: -122.4195 },

  // ── Potrero Hill / Dogpatch ───────────────────────────────────────────────────
  { content: 'potrero hill on a clear day. the bay, the bridges, the mountains. unbeatable.',              pen_name: 'PotreMillViewer',  lat: 37.7573, lng: -122.3995 },
  { content: 'dogpatch brunch. the industrial-to-artisanal pipeline is complete and it is delicious.',    pen_name: 'DogpatchDiner',    lat: 37.7600, lng: -122.3896 },

  // ── Random / Atmospheric ─────────────────────────────────────────────────────
  { content: 'sf fog at 4pm is not weather it is a personality the city puts on for the evening',          pen_name: 'FogPersonality',   lat: 37.7781, lng: -122.4180 },
  { content: 'karl the fog rolled in over twin peaks and swallowed the sunset. fine. we adapt.',           pen_name: 'KarlFan',          lat: 37.7530, lng: -122.4477 },
  { content: 'someone left an elaborate chalk mural on 18th. three people were crying looking at it.',    pen_name: null,               lat: 37.7620, lng: -122.4264 },
  { content: 'muni breakdown at 3pm. twelve strangers decide to walk. friendships formed.',               pen_name: 'MuniWalker',       lat: 37.7790, lng: -122.4189 },
  { content: 'the hills here are not a metaphor they are just genuinely steep. calves of steel required.', pen_name: null,              lat: 37.7870, lng: -122.4320 },
  { content: 'bay area weather: fog, 58 degrees, perfect. this is the setting for all of my memories.',   pen_name: 'BayAreaWeather',   lat: 37.7750, lng: -122.4194 },
]

const AREAS = [
  { name: 'Castro',                count: 6  },
  { name: 'Mission',               count: 8  },
  { name: 'SoMa',                  count: 4  },
  { name: 'North Beach',           count: 5  },
  { name: 'Haight-Ashbury',        count: 4  },
  { name: 'Hayes Valley',          count: 4  },
  { name: 'Embarcadero / FiDi',    count: 5  },
  { name: 'Richmond',              count: 5  },
  { name: 'Sunset',                count: 4  },
  { name: 'Noe Valley',            count: 3  },
  { name: 'Bernal / Glen Park',    count: 4  },
  { name: 'Golden Gate Park',      count: 4  },
  { name: 'Presidio / Marina',     count: 4  },
  { name: 'TL / Civic / Dogpatch', count: 4  },
  { name: 'Atmospheric',           count: 6  },
]

async function seed() {
  console.log('Clearing SF seed data…')
  const sfIds = Array.from({ length: 85 }, (_, i) => `${SF_PREFIX}${String(i).padStart(12, '0')}`)
  const { error: delErr } = await supabase.from('thots').delete().in('session_id', sfIds)
  if (delErr) console.warn('Warning — could not clear SF seed data:', delErr.message)
  else console.log('✓ Cleared\n')

  console.log(`Seeding ${THOTS.length} thots across San Francisco…\n`)

  const now = Date.now()
  const rows = THOTS.map((t, i) => ({
    content:    t.content,
    pen_name:   t.pen_name,
    session_id: `${SF_PREFIX}${String(i).padStart(12, '0')}`,
    ip_hash:    createHash('sha256').update(`sf-${i}${IP_SALT}`).digest('hex'),
    location:   `SRID=4326;POINT(${t.lng} ${t.lat})`,
    created_at: new Date(now - i * 90 * 1000).toISOString(),
    expires_at: SEVEN_DAYS,
    is_seed:    true,
    hidden:     true,
  }))

  const { data, error } = await supabase.from('thots').insert(rows).select('id')
  if (error) { console.error('Seed failed:', error.message); process.exit(1) }

  console.log(`✓ Inserted ${data.length} thots:\n`)
  AREAS.forEach(({ name, count }) => console.log(`  ${name.padEnd(24)} ${count} thots`))
}

seed()
