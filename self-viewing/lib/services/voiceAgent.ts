import { formatPrice, generalFacts, property, rooms, type Room } from "../property";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK: AI voice agent
// Production: a real-time voice agent (e.g. Vapi, Retell, Bland) places an
// actual phone call to the buyer when the lock reports "door opened", with the
// listing data + seller Q&A as its knowledge base and an LLM behind it.
//
// Here: the "call" is an in-page UI, answers come from simple keyword matching
// against the fake listing, and the browser's speechSynthesis reads replies
// aloud. Swap answerQuestion() for an LLM / voice-agent session later.
// ─────────────────────────────────────────────────────────────────────────────

// Topics the AI must never handle itself — regulatory boundary. These always
// route to a licensed human agent.
const HANDOFF_TOPICS: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["negotiat", "lower", "discount", "best price", "accept less", "go down", "haggle", "reduce"],
    answer:
      "I'm not able to negotiate on price — that has to go through a licensed agent. If you'd like, I can pass an offer to them after your viewing and they'll take it from there.",
  },
  {
    keywords: ["contract", "legal", "lawyer", "solicitor", "notary", "deposit", "paperwork", "title deed"],
    answer:
      "Legal paperwork and contracts are handled by a licensed agent and your legal representative, so I can't advise on that. I'll make sure the agent knows you asked.",
  },
];

const PRICE_WORDS = ["price", "asking", "cost", "how much"];
const OFFER_WORDS = ["offer", "buy it", "make an offer", "put in"];

export function roomIntro(room: Room) {
  return room.intro;
}

export function greeting(buyerName: string) {
  return `Hi ${buyerName || "there"}, this is your AI viewing assistant for ${property.address}. I can see you've just let yourself in. I'll guide you room by room — just tap a room as you walk into it, and ask me anything.`;
}

function matches(q: string, keywords: string[]) {
  return keywords.some((k) => q.includes(k));
}

export async function answerQuestion(question: string, currentRoomId: string | null): Promise<string> {
  // TODO(integration): replace with LLM call / voice-agent tool call.
  const q = question.toLowerCase();

  for (const t of HANDOFF_TOPICS) if (matches(q, t.keywords)) return t.answer;

  if (matches(q, OFFER_WORDS))
    return "Great to hear you're interested! When you tap “End viewing” I'll help you put an offer together, and a licensed agent will follow up to handle it.";
  if (matches(q, PRICE_WORDS))
    return `The asking price is ${formatPrice(property.price)}. Any discussion about price goes through a licensed agent — I can connect you after the viewing.`;

  // 1) Question names another room ("how big is the garden?") → that room's facts.
  for (const r of rooms) {
    if (r.id === currentRoomId) continue;
    if (q.includes(r.id) || q.includes(r.name.toLowerCase().split(" ")[0])) {
      for (const f of r.facts) if (matches(q, f.keywords)) return f.answer;
    }
  }
  // 2) The room the buyer is standing in (unless they ask about the whole house).
  const room = rooms.find((r) => r.id === currentRoomId);
  const wholeHouse = matches(q, ["total", "house", "property", "home"]);
  if (room && !wholeHouse) for (const f of room.facts) if (matches(q, f.keywords)) return f.answer;
  // 3) Whole-property knowledge.
  for (const f of generalFacts) if (matches(q, f.keywords)) return f.answer;
  if (room && matches(q, ["this room", "here", "tell me about"])) return room.intro;

  return "Good question — I don't have that detail on file. I've noted it, and a licensed agent will get back to you with an answer after the viewing.";
}
