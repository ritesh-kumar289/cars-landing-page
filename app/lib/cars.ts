export type Act = {
  id: string;
  title: string;
  subtitle: string;
  bodyTop?: string;
  body: string;
  meta: { label: string; value: string }[];
  // Index of the act (0 = hero/title, 1..N = car acts, last = credits)
  index: number;
};

export type Car = {
  id: string;
  name: string;
  series: string;
  era: string;
  origin: string;
  model: string; // path under /public
  // Camera & object positioning per car (act space)
  scale: number;
  yOffset: number;
  rotationY: number;
  // Cinematic palette
  rim: string;       // hex (key/rim light color)
  fill: string;      // hex (fill light color)
  ground: string;    // hex (ground tint)
  // Director's note (shown as caption)
  note: string;
};

export const CARS: Car[] = [
  {
    id: 'w13',
    name: 'Mercedes W13',
    series: 'F1 — 2022 Concept',
    era: '2022',
    origin: 'Brackley, UK',
    model: '/models/f1_mercedes_w13_concept.glb',
    scale: 1.0,
    yOffset: -0.4,
    rotationY: -0.6,
    rim: '#7dd3fc',
    fill: '#0ea5e9',
    ground: '#0b1620',
    note: 'Silver arrows. Scalpel aero. The whisper before the war.',
  },
  {
    id: 'f40',
    name: 'Ferrari F40',
    series: 'Hypercar — 1987',
    era: '1987',
    origin: 'Maranello, IT',
    model: '/models/ferrari_f40/scene.gltf',
    scale: 1.4,
    yOffset: -0.65,
    rotationY: 0.5,
    rim: '#ff3b1f',
    fill: '#7f1d1d',
    ground: '#1a0a08',
    note: "Enzo's farewell. Twin-turbo, naked carbon, no apologies.",
  },
  {
    id: 'mclaren',
    name: 'McLaren MP4',
    series: 'F1 — Papaya',
    era: '1990s',
    origin: 'Woking, UK',
    model: '/models/mclaren_mp45__formula_1.glb',
    scale: 1.0,
    yOffset: -0.5,
    rotationY: -0.4,
    rim: '#fb923c',
    fill: '#9a3412',
    ground: '#1a1208',
    note: 'Papaya streak. Senna ghosts in the wet at Donington.',
  },
  {
    id: 'rwb',
    name: 'Porsche 911 RWB',
    series: 'Tuner — Rauh-Welt',
    era: 'Modern',
    origin: 'Chiba, JP',
    model: '/models/porsche_911_rauh-welt_free.glb',
    scale: 1.2,
    yOffset: -0.55,
    rotationY: 0.7,
    rim: '#a78bfa',
    fill: '#1e1b4b',
    ground: '#0e0a1f',
    note: 'Nakai-san carves the body by hand. Each one — heresy and prayer.',
  },
  {
    id: 'sf2019',
    name: 'Ferrari SF90',
    series: 'F1 — 2019',
    era: '2019',
    origin: 'Maranello, IT',
    model: '/models/ferrari_f1_2019/scene.gltf',
    scale: 1.3,
    yOffset: -0.55,
    rotationY: -0.5,
    rim: '#ef4444',
    fill: '#450a0a',
    ground: '#180404',
    note: 'Scarlet and screaming. The last of the old V6 hybrids in full song.',
  },
  {
    id: 'generico',
    name: 'Formula Apex',
    series: 'F1 — Concept',
    era: 'Tomorrow',
    origin: 'Anywhere',
    model: '/models/formula_1_generico_2.glb',
    scale: 1.0,
    yOffset: -0.5,
    rotationY: 0.3,
    rim: '#f5f1e8',
    fill: '#3f3f46',
    ground: '#0a0a0a',
    note: 'No livery. No country. Just the shape of speed itself.',
  },
];

// Total scroll acts = 1 (hero) + cars + 1 (credits)
export const ACTS: Act[] = [
  {
    id: 'hero',
    index: 0,
    title: 'OFF TRACKS',
    subtitle: 'Off the tracks. Driven obsessions.',
    body: 'A private collection of machines that should not exist — and the films we shoot about them. Scroll to enter.',
    meta: [
      { label: 'Reel', value: 'No. 07' },
      { label: 'Year', value: '2025' },
      { label: 'Format', value: '70mm / 24fps' },
    ],
  },
  ...CARS.map<Act>((c, i) => ({
    id: c.id,
    index: i + 1,
    title: c.name,
    subtitle: c.series,
    bodyTop: `Act ${String(i + 1).padStart(2, '0')} — ${c.era}`,
    body: c.note,
    meta: [
      { label: 'Origin', value: c.origin },
      { label: 'Era', value: c.era },
      { label: 'Class', value: c.series },
    ],
  })),
  {
    id: 'credits',
    index: CARS.length + 1,
    title: 'End of reel.',
    subtitle: 'Find what others can\u2019t.',
    body: 'OFF TRACKS sources, documents, and films one-of-one machines for collectors who treat speed as a language. Request access to the next reel.',
    meta: [
      { label: 'Direction', value: 'OFF TRACKS Studio' },
      { label: 'Score', value: 'Original' },
      { label: 'Stock', value: 'Kodak 5219' },
    ],
  },
];

export const TOTAL_ACTS = ACTS.length;
