const ADJECTIVES = [
  "Silent","Hollow","Vague","Phantom","Neon","Void","Lucid","Static",
  "Onyx","Azure","Ember","Ashen","Feral","Wired","Velvet","Crimson",
  "Opaque","Drift","Liminal","Null","Stray","Buried","Faint","Rogue",
  "Sable","Tidal","Muted","Ghost","Woven","Obsidian"
];
const NOUNS = [
  "Drifter","Signal","Node","Echo","Specter","Vector","Cipher","Wraith",
  "Fracture","Nexus","Shard","Relay","Pulse","Veil","Marker","Thread",
  "Glyph","Warden","Conduit","Nomad","Relic","Trace","Archive","Proxy",
  "Prism","Hollow","Beacon","Static","Flare","Kernel"
];

export function generatePenName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}${noun}`;
}

const SESSION_KEY = "thots_session";

export function getOrCreateSession() {
  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch {}
  if (!session) {
    session = {
      id: crypto.randomUUID(),
      type: null, // 'anon' | 'user'
      penName: null,
      ageVerified: false,
      createdAt: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

export function updateSession(updates) {
  const session = getOrCreateSession();
  const updated = { ...session, ...updates };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return updated;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
