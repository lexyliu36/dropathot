/**
 * Demo seed — 75 thots across Pittsburgh: Shadyside, Oakland, Squirrel Hill, Lawrenceville,
 * East Liberty, Bloomfield, Strip District, Downtown, Mt Washington, and edges beyond.
 *
 * Usage:  node --env-file=server/.env server/seed-pittsburgh.js
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const IP_SALT   = process.env.IP_SALT ?? 'dev'
const PGH_PREFIX = 'e0000000-0000-0000-0000-'
const FAR_FUTURE = new Date(Date.now() + 100 * 365.25 * 24 * 3600 * 1000).toISOString()

const THOTS = [
  // ── Shadyside ─────────────────────────────────────────────────────────────────
  { content: 'walnut street on a saturday. the coffee shops are full and everyone has a plan.',              pen_name: 'WalnutStWalker',   lat: 40.4519, lng: -79.9302 },
  { content: 'shadyside is four separate vibes on four consecutive blocks and i respect that',               pen_name: 'FourVibesShadyside',               lat: 40.4524, lng: -79.9285 },
  { content: 'ellsworth avenue at dusk. quiet enough to think. close enough to everything.',                pen_name: 'EllsworthLocal',   lat: 40.4563, lng: -79.9288 },
  { content: 'the shadyside hospital parking garage has a rooftop view nobody talks about',                  pen_name: 'SecretViews_PGH', lat: 40.4536, lng: -79.9402 },
  { content: 'found an independent record shop on south highland that still does listening stations',        pen_name: 'VinylFinder',      lat: 40.4506, lng: -79.9320 },
  { content: 'the bagel shop line on sunday morning is 20 people deep and worth it every time',             pen_name: 'BagelShadyside',   lat: 40.4521, lng: -79.9260 },
  { content: 'wightman park tennis courts at 7am. just the sound of it. just quiet.',                       pen_name: 'WightmanMorning',               lat: 40.4487, lng: -79.9255 },

  // ── Oakland ───────────────────────────────────────────────────────────────────
  { content: 'carnegie museum of natural history on a monday. you get the dinosaurs to yourself.',          pen_name: 'DinoEnthusiast',   lat: 40.4438, lng: -79.9487 },
  { content: 'cathedral of learning is the most bizarre beautiful building in pennsylvania. climb it.',     pen_name: 'CathedralFan',     lat: 40.4443, lng: -79.9531 },
  { content: 'forbes ave at 8am. cmu kids, pitt kids, and people who are not in school pretending.',       pen_name: 'ForbesAveEarlyBird',               lat: 40.4421, lng: -79.9452 },
  { content: 'schenley park in october. the colors here are genuinely insane.',                             pen_name: 'FallColorsFan',    lat: 40.4348, lng: -79.9432 },
  { content: 'phipps conservatory after dark. the glass dome lit up. you live here now.',                  pen_name: 'PhippsNightOwl',   lat: 40.4383, lng: -79.9438 },
  { content: 'pitt football game day in oakland. the city changes its entire personality.',                pen_name: 'GameDayOakland',               lat: 40.4415, lng: -79.9574 },
  { content: 'the o on oakland ave. open all night. ate a breakfast sandwich at 3am. no regrets.',        pen_name: 'TheORegular',      lat: 40.4452, lng: -79.9531 },

  // ── Squirrel Hill ─────────────────────────────────────────────────────────────
  { content: 'murray avenue deli counter. the sandwiches are enormous and the arguments are friendly.',     pen_name: 'MurrayAveSandwich', lat: 40.4323, lng: -79.9226 },
  { content: 'forward avenue at sunset. tree canopy, brick sidewalks, the best residential block in pgh.', pen_name: 'ForwardAveLocal',               lat: 40.4335, lng: -79.9266 },
  { content: 'frick park trails at 6am. three miles of trees inside the city.',                            pen_name: 'FrickParkRunner',  lat: 40.4241, lng: -79.9059 },
  { content: 'squirrel hill has been a neighborhood since before pittsburgh was interesting. it still is.', pen_name: 'SqHillLifer',     lat: 40.4307, lng: -79.9218 },
  { content: 'dobra tea on forbes. sit. stay two hours. order another. it is allowed.',                    pen_name: 'DobraTea_fan',     lat: 40.4327, lng: -79.9203 },

  // ── Lawrenceville ─────────────────────────────────────────────────────────────
  { content: 'butler street is what every city wants its arts district to be.',                             pen_name: 'ButlerSt_Local',   lat: 40.4658, lng: -79.9672 },
  { content: 'the lawrenceville brewery scene is getting out of hand. in a good way.',                     pen_name: 'BreweryLawrence',               lat: 40.4650, lng: -79.9654 },
  { content: 'allegheny cemetery at dawn. so old. so quiet. the city outside feels very far.',            pen_name: 'CemeteryWalker',   lat: 40.4657, lng: -79.9570 },
  { content: 'round corner cantina on the porch in summer. the street sounds right from here.',            pen_name: 'PorchSittinPGH',  lat: 40.4642, lng: -79.9655 },
  { content: 'the pizza at brgr is unrelated to burgers and still the best pizza in the neighborhood',    pen_name: 'BRGRPizzaFan',               lat: 40.4630, lng: -79.9676 },
  { content: 'doughnut love pgh. only open three days a week. every week there is a line.',               pen_name: 'DonutPilgrimage',  lat: 40.4662, lng: -79.9665 },

  // ── East Liberty / Garfield ───────────────────────────────────────────────────
  { content: 'east liberty is still figuring out what it is. the tension is honest.',                      pen_name: 'EastLibertyEyes',  lat: 40.4611, lng: -79.9225 },
  { content: 'the church on penn avenue is bigger than most towns. empty on tuesday. beautiful always.',   pen_name: 'PennAvePenn',               lat: 40.4603, lng: -79.9241 },
  { content: 'tuesday standup night at the club cafe. twelve comics. three really had it.',               pen_name: 'ClubCafeRegular',  lat: 40.4537, lng: -79.9349 },
  { content: 'garfield rooftop farm. vegetables with a view of the city. someone built the right thing.',  pen_name: 'UrbanFarmFan',     lat: 40.4662, lng: -79.9447 },

  // ── Bloomfield (Little Italy) ─────────────────────────────────────────────────
  { content: 'bloomfield bridge at 7pm. watching the city below. three rivers somewhere behind you.',     pen_name: 'BridgeWatcher_PGH', lat: 40.4614, lng: -79.9476 },
  { content: 'the italian restaurant on liberty that has been here since 1946. the meatballs.',           pen_name: 'Sunday_Gravy_PGH', lat: 40.4612, lng: -79.9511 },
  { content: 'bloomfield on a random thursday is the most neighborhood neighborhood in this city.',        pen_name: 'BloomfieldThursday',               lat: 40.4607, lng: -79.9498 },
  { content: 'union project space on penn. the building deserves the art they put in it.',                pen_name: 'UnionProjectFan',  lat: 40.4621, lng: -79.9475 },

  // ── Strip District ────────────────────────────────────────────────────────────
  { content: 'strip district saturday morning. pennsylvania produce, cheese, fish, coffee, everything.',   pen_name: 'StripDistSat',     lat: 40.4492, lng: -79.9878 },
  { content: 'pennsylvania macaroni co. has been on penn ave since the 1900s and shows no sign of stopping.', pen_name: 'PaMacCo_Fan',  lat: 40.4497, lng: -79.9845 },
  { content: 'primanti brothers at 2am. coleslaw on everything. correct.',                                pen_name: 'PrimantiPurist',   lat: 40.4505, lng: -79.9858 },
  { content: 'the strip at 6am before the crowds. just the vendors setting up. feels like a secret.',    pen_name: 'StripAt6am',               lat: 40.4483, lng: -79.9891 },
  { content: 'klavon\'s ice cream parlor. 1923. everything is original. order the fudge ripple.',        pen_name: 'KlavonsRegular',   lat: 40.4490, lng: -79.9875 },

  // ── Downtown / Cultural District ──────────────────────────────────────────────
  { content: 'ppg place ice rink in december. the glass towers above you. everything looks like a film set.', pen_name: 'PPGWinterFan', lat: 40.4412, lng: -80.0029 },
  { content: 'point state park at the confluence. three rivers meeting. stand here long enough.',          pen_name: 'ThreeRiversFan',   lat: 40.4416, lng: -80.0114 },
  { content: 'heinz hall lobby on a concert night. the dome. the crowd. the sound already.',              pen_name: 'HeinzHallFan',     lat: 40.4461, lng: -79.9997 },
  { content: 'market square at lunch. every table full. everyone from downtown. loud and correct.',       pen_name: 'MarketSquareLunch',               lat: 40.4402, lng: -80.0002 },
  { content: 'wood street galleries. free admission. four floors of current art. downtown\'s best keep.', pen_name: 'WoodStGallery',    lat: 40.4418, lng: -79.9992 },

  // ── Mt Washington ─────────────────────────────────────────────────────────────
  { content: 'incline up to mt washington. the city comes into frame as the car climbs. every time.',     pen_name: 'InclineRider',     lat: 40.4284, lng: -80.0195 },
  { content: 'grandview avenue overlook at night. the downtown lights on the rivers. unmatched.',          pen_name: 'GrandviewGazer',   lat: 40.4271, lng: -80.0159 },
  { content: 'mt washington on a clear day: you can see where the rivers go. the city unrolls.',          pen_name: 'MtWashClearDay',               lat: 40.4262, lng: -80.0132 },
  { content: 'the duquesne incline is 149 years old. it still works better than my subway.',             pen_name: 'DuquesneIncline',  lat: 40.4280, lng: -80.0195 },

  // ── North Side / PNC Park ─────────────────────────────────────────────────────
  { content: 'pnc park is objectively the best baseball stadium in america. the bridge, the view.',       pen_name: 'PNCParkFan',       lat: 40.4469, lng: -80.0057 },
  { content: 'andy warhol museum on a slow afternoon. his diaries in a vitrine. still strange.',          pen_name: 'WarholVisitor',    lat: 40.4484, lng: -80.0098 },
  { content: 'the northside neighborhood streets behind the stadium. old pittsburgh frozen in amber.',    pen_name: 'NorthSideAmber',               lat: 40.4530, lng: -80.0100 },
  { content: 'mexican war streets: the block names are historical, the houses are beautiful, the coffee is great.', pen_name: 'MexWarSt_Fan', lat: 40.4560, lng: -80.0055 },

  // ── South Side ────────────────────────────────────────────────────────────────
  { content: 'east carson at 11pm on a friday. bars from end to end. the yinzer energy is actual energy.', pen_name: 'YinzerEnergy',   lat: 40.4284, lng: -79.9801 },
  { content: 'south side slopes: stairs instead of streets. the view at the top earns itself.',          pen_name: 'SlopeStairClimber', lat: 40.4270, lng: -79.9712 },
  { content: 'the monongahela river trail at dawn. the industrial south side waking up.',                 pen_name: 'MonRiverDawn',               lat: 40.4290, lng: -79.9630 },

  // ── Carnegie / Homestead edge ─────────────────────────────────────────────────
  { content: 'carnegie library main branch. free. enormous. been here since 1895.',                       pen_name: 'LibraryLifer_PGH', lat: 40.4405, lng: -79.9487 },

  // ── Bridges ───────────────────────────────────────────────────────────────────
  { content: 'pittsburgh has 446 bridges. i\'ve started. goal: all of them.',                             pen_name: 'BridgeCounter',    lat: 40.4447, lng: -79.9997 },
  { content: 'the andy warhol bridge pedestrian walkway at dusk. yellow. iconic.',                        pen_name: 'WarhoBridgeDusk',               lat: 40.4507, lng: -80.0044 },
  { content: 'walking across the smithfield street bridge. the cables like a harp the city plays.',       pen_name: 'BridgePoet_PGH',  lat: 40.4413, lng: -80.0041 },

  // ── Sports culture ────────────────────────────────────────────────────────────
  { content: 'steelers sunday. the whole city quiets and then erupts on the same play.',                  pen_name: 'SteelersSunday',               lat: 40.4468, lng: -80.0158 },
  { content: 'penguins playoff game. pittsburgh in winter is a different animal entirely.',               pen_name: 'PensLifer',        lat: 40.4393, lng: -80.0037 },
  { content: 'pirates extra innings game staying to the end with a stranger. ended 12th. worth it.',     pen_name: 'ExtraInningsKid',  lat: 40.4469, lng: -80.0057 },

  // ── Atmospheric / Yinzer ────────────────────────────────────────────────────── 
  { content: 'the word yinz is doing work that five words in other dialects couldn\'t do',               pen_name: 'YinzLinguist',     lat: 40.4441, lng: -79.9978 },
  { content: 'pittsburgh is not the rust belt it is what comes after the rust belt and its name is this', pen_name: 'PostRustBelt',              lat: 40.4510, lng: -79.9660 },
  { content: 'three rivers, seven hills, one attitude. you either get it or you move to philadelphia.',  pen_name: 'ThreeRiversPhil',  lat: 40.4430, lng: -80.0050 },
  { content: 'overcast sky over the ohio river. the grey here is not sad it is just honest.',            pen_name: 'OhioRiverGrey',    lat: 40.4670, lng: -80.0320 },
  { content: 'the g-20 shutdown in 2009 turned downtown into a ghost town. a different city lives here.', pen_name: 'G20Ghost',             lat: 40.4400, lng: -80.0008 },
  { content: 'moved here five years ago thinking two years. still here. this city does that to you.',   pen_name: 'Stayed_In_PGH',    lat: 40.4525, lng: -79.9318 },
]

const AREAS = [
  { name: 'Shadyside',             count: 7  },
  { name: 'Oakland',               count: 7  },
  { name: 'Squirrel Hill',         count: 5  },
  { name: 'Lawrenceville',         count: 6  },
  { name: 'East Liberty/Garfield', count: 4  },
  { name: 'Bloomfield',            count: 4  },
  { name: 'Strip District',        count: 5  },
  { name: 'Downtown',              count: 5  },
  { name: 'Mt Washington',         count: 4  },
  { name: 'North Side',            count: 4  },
  { name: 'South Side',            count: 3  },
  { name: 'Bridges',               count: 3  },
  { name: 'Sports',                count: 3  },
  { name: 'Atmospheric',           count: 6  },
]

async function seed() {
  console.log('Clearing Pittsburgh seed data…')
  const pghIds = Array.from({ length: 85 }, (_, i) => `${PGH_PREFIX}${String(i).padStart(12, '0')}`)
  // Must delete reports first — reports_thot_id_fkey blocks thot deletion
  const { data: _seedThots } = await supabase
    .from('thots').select('id').in('session_id', pghIds)
  if (_seedThots?.length) {
    const _ids = _seedThots.map(t => t.id)
    await supabase.from('reports').delete().in('thot_id', _ids)
  }

  const { error: delErr } = await supabase.from('thots').delete().in('session_id', pghIds)
  if (delErr) console.warn('Warning — could not clear Pittsburgh seed data:', delErr.message)
  else console.log('✓ Cleared\n')

  console.log(`Seeding ${THOTS.length} thots across Pittsburgh…\n`)

  const now = Date.now()
  const rows = THOTS.map((t, i) => ({
    content:    t.content,
    pen_name:   t.pen_name,
    session_id: `${PGH_PREFIX}${String(i).padStart(12, '0')}`,
    ip_hash:    createHash('sha256').update(`pgh-${i}${IP_SALT}`).digest('hex'),
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
