import Link from "next/link";
import { townCentral } from "@/world/townCentral";
import { INTENTS } from "@/world/schema";

export default function Home() {
  const districts = townCentral.districts.filter((d) => d.id !== "town-square");

  return (
    <main className="min-h-full bg-gradient-to-b from-[#1e2733] to-[#12303a] text-parchment">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
        {/* Hero */}
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-parchment/50">
          the presence layer for professional networking
        </p>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-6xl">
          A live professional world you can <span className="text-grass">walk around</span>.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-parchment/80">
          Not another search-and-DM directory. Enter a cozy 2D world, wander through
          districts, notice real people, walk up to them, and connect through
          serendipity — the way networking happens at a great conference.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/world"
            className="rounded-xl bg-grass px-6 py-3 text-lg font-semibold text-ink shadow-lg transition hover:brightness-110"
          >
            Enter the world →
          </Link>
          <span className="text-sm text-parchment/50">
            No install. Desktop browser. Click, WASD or arrow keys.
          </span>
        </div>

        {/* How it works */}
        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            ["Wander", "Explore streets, plazas and districts from a top-down view."],
            ["Discover", "Notice people nearby and see why they're here — raising, hiring, exploring."],
            ["Connect", "Walk up to talk. Click for their profile. One more click to connect."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-mono uppercase tracking-widest text-grass">
                {title}
              </div>
              <p className="mt-2 text-sm text-parchment/75">{body}</p>
            </div>
          ))}
        </div>

        {/* Districts */}
        <div className="mt-20">
          <h2 className="text-2xl font-semibold">Districts in Town Central</h2>
          <p className="mt-1 text-sm text-parchment/60">
            One connected world — walk between all of them.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {districts.map((d) => (
              <span
                key={d.id}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
                style={{ color: d.accent }}
              >
                {d.name}
              </span>
            ))}
          </div>
        </div>

        {/* Intent signals */}
        <div className="mt-16">
          <h2 className="text-2xl font-semibold">Show why you're here</h2>
          <p className="mt-1 text-sm text-parchment/60">
            Temporary intent signals make every encounter useful.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {Object.values(INTENTS).map((i) => (
              <span
                key={i.label}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-white"
                style={{ background: i.color }}
              >
                {i.emoji} {i.label}
              </span>
            ))}
          </div>
        </div>

        <footer className="mt-24 border-t border-white/10 pt-8 text-sm text-parchment/40">
          <p>itsartc — early foundation build. The world is data-driven and editable by design.</p>
        </footer>
      </div>
    </main>
  );
}
