// Fake listing used throughout the prototype. Deliberately market-neutral:
// no city, country, currency convention or local regulation is implied.
// In production this would come from the agency's listing feed / portal API.

export type Room = {
  id: string;
  name: string;
  photo: string;
  intro: string; // what the AI agent says when the buyer walks into this room
  facts: { keywords: string[]; answer: string }[];
  suggestions: string[];
};

export const CURRENCY_SYMBOL = "$"; // placeholder — set per market later

export function formatPrice(n: number) {
  return `${CURRENCY_SYMBOL}${n.toLocaleString("en-US")}`;
}

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=70`;

export const property = {
  id: "demo-14-linden-row",
  title: "Bright 3-bed family home with garden",
  address: "14 Linden Row",
  area: "Riverside Quarter",
  price: 485000,
  beds: 3,
  baths: 2,
  sizeSqm: 128,
  builtYear: 1998,
  energyRating: "B",
  agency: "Demo Realty",
  portal: "HomeFinder",
  heroPhoto: img("photo-1568605114967-8130f3a36994"),
  gallery: [
    img("photo-1600596542815-ffad4c1539a9"),
    img("photo-1586023492125-27b2c045efd7"),
    img("photo-1556909114-f6e7ad7d3136"),
    img("photo-1505693416388-ac5ce068fe85"),
  ],
  description:
    "A light-filled detached home on a quiet tree-lined street. Open-plan kitchen and dining, south-facing garden, three good-sized bedrooms and off-street parking. Available for self-guided viewings — book a slot, verify your ID, and let yourself in with a one-time access code.",
  highlights: ["South-facing garden", "Renovated kitchen (2022)", "Off-street parking", "Energy rating B"],
};

export const rooms: Room[] = [
  {
    id: "entrance",
    name: "Entrance hall",
    photo: img("photo-1600585154340-be6161a56a0c"),
    intro:
      "Welcome in! You're in the entrance hall. The boiler cupboard is the door on your left, and the living room is straight ahead. Ask me anything as you go.",
    facts: [
      { keywords: ["cupboard", "storage", "coat"], answer: "The hall cupboard is about 1.2 m deep — it fits coats, a vacuum and the boiler with room to spare." },
      { keywords: ["floor", "flooring", "tiles"], answer: "The hall has porcelain tiles laid in 2019, with underfloor heating on its own thermostat." },
    ],
    suggestions: ["How old is the boiler?", "What's the total size?", "Is there storage?"],
  },
  {
    id: "living",
    name: "Living room",
    photo: img("photo-1586023492125-27b2c045efd7"),
    intro:
      "This is the living room — about 24 square metres. It faces south, so it gets sun most of the afternoon. The fireplace is decorative.",
    facts: [
      { keywords: ["fireplace", "fire"], answer: "The fireplace is decorative only — the flue was capped in 2015. It could be reopened with a survey." },
      { keywords: ["sun", "light", "orientation", "face", "south"], answer: "The living room faces south, so you get direct sun from around late morning until early evening." },
      { keywords: ["window", "windows", "glazing"], answer: "Windows are double-glazed uPVC, replaced in 2016, with a transferable warranty." },
      { keywords: ["size", "big", "square", "sqm", "dimensions"], answer: "The living room is roughly 24 m² — about 6.0 m by 4.0 m." },
    ],
    suggestions: ["Which way does it face?", "Are the windows new?", "Does the fireplace work?"],
  },
  {
    id: "kitchen",
    name: "Kitchen & dining",
    photo: img("photo-1556909114-f6e7ad7d3136"),
    intro:
      "You're in the kitchen and dining area. It was fully renovated in 2022 — worktops, cabinets and appliances. The back door leads to the garden.",
    facts: [
      { keywords: ["appliance", "appliances", "oven", "hob", "fridge", "dishwasher"], answer: "The oven, induction hob, dishwasher and fridge-freezer were all installed in 2022 and are included in the sale." },
      { keywords: ["worktop", "counter", "countertop"], answer: "The worktops are quartz composite, fitted during the 2022 renovation." },
      { keywords: ["renovat", "new", "when"], answer: "The kitchen was fully renovated in 2022, including new plumbing to the sink and dishwasher." },
      { keywords: ["size", "big", "square", "sqm", "dimensions"], answer: "The kitchen and dining space together are about 30 m²." },
    ],
    suggestions: ["Are the appliances included?", "When was it renovated?", "How big is the garden?"],
  },
  {
    id: "bedroom",
    name: "Main bedroom",
    photo: img("photo-1505693416388-ac5ce068fe85"),
    intro:
      "This is the main bedroom, about 16 square metres, with fitted wardrobes along the left wall. The en-suite shower room is through the door on your right.",
    facts: [
      { keywords: ["wardrobe", "closet", "storage"], answer: "The fitted wardrobes run the full 3.8 m wall and are included in the sale." },
      { keywords: ["ensuite", "en-suite", "shower", "bathroom"], answer: "The en-suite has a walk-in shower, WC and basin. It was refitted in 2020." },
      { keywords: ["noise", "quiet", "street"], answer: "This bedroom is at the back of the house, overlooking the garden, so it's the quietest room." },
      { keywords: ["size", "big", "square", "sqm", "dimensions"], answer: "The main bedroom is about 16 m², not counting the en-suite." },
    ],
    suggestions: ["Is it quiet at night?", "Are the wardrobes included?", "Tell me about the en-suite"],
  },
  {
    id: "garden",
    name: "Garden",
    photo: img("photo-1600566753190-17f0baa2a6c3"),
    intro:
      "And here's the garden — roughly 110 square metres, south-facing, with a paved terrace and a lawn. The shed at the back stays with the house.",
    facts: [
      { keywords: ["shed"], answer: "The timber shed is included — it has power and a light." },
      { keywords: ["size", "big", "square", "sqm", "dimensions"], answer: "The garden is about 110 m² — a 30 m² paved terrace plus lawn." },
      { keywords: ["fence", "boundary", "private", "overlooked"], answer: "It's fully fenced on all sides and not directly overlooked from the rear." },
    ],
    suggestions: ["Is the shed included?", "Is it overlooked?", "Where do I park?"],
  },
];

// Property-wide knowledge the AI agent can answer from any room.
export const generalFacts: { keywords: string[]; answer: string }[] = [
  { keywords: ["boiler", "heating", "radiator"], answer: "The boiler is a gas combi, installed in 2019 and serviced every year — last service was 5 months ago. It's in the hall cupboard." },
  { keywords: ["total size", "square footage", "sqm", "square metres", "square meters", "floor area", "how big is the house", "total"], answer: "The house is about 128 m² of internal floor area, plus the garden of around 110 m²." },
  { keywords: ["bedroom", "bedrooms", "how many rooms"], answer: "There are three bedrooms: the main bedroom with en-suite, a double, and a single that's currently used as a study." },
  { keywords: ["bathroom", "bathrooms"], answer: "There are two bathrooms — the family bathroom upstairs and the main bedroom's en-suite." },
  { keywords: ["built", "age", "old is the house", "year"], answer: "The house was built in 1998." },
  { keywords: ["energy", "epc", "insulation", "bills"], answer: "It has an energy rating of B. The loft was re-insulated in 2021." },
  { keywords: ["roof"], answer: "The roof was inspected last year with no issues reported. Tiles are original from 1998." },
  { keywords: ["damp", "mould", "mold", "leak"], answer: "The seller reports no known damp or leaks, and the last survey didn't flag any. A survey is always recommended." },
  { keywords: ["park", "parking", "car", "garage"], answer: "There's off-street parking for two cars on the driveway at the front." },
  { keywords: ["school", "schools"], answer: "There's a primary school about 8 minutes' walk away and a secondary school about 15 minutes away." },
  { keywords: ["transport", "bus", "train", "station", "commute"], answer: "A bus stop is 3 minutes' walk away, and the nearest train station is about 12 minutes on foot." },
  { keywords: ["internet", "broadband", "fibre", "fiber", "wifi"], answer: "Full-fibre broadband is available at the property." },
  { keywords: ["neighbour", "neighbor", "street", "area", "neighbourhood", "neighborhood"], answer: "It's a quiet residential street with mostly families. There's a park about 5 minutes' walk away." },
  { keywords: ["why", "selling", "seller", "vendor"], answer: "The sellers are relocating for work. They've told us they're flexible on timing." },
  { keywords: ["fees", "service charge", "tax", "charges"], answer: "There's no service charge — it's a freehold detached house. For local taxes and fees, a licensed agent can give you exact figures." },
  { keywords: ["pet", "pets", "dog", "cat"], answer: "The garden is fully fenced, which works well for pets." },
];
