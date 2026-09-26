"use client";

import Link from "next/link";
import { useState } from "react";
import { Photo, RestartButton } from "@/components/Shell";
import { formatPrice, property } from "@/lib/property";

// Step 1 — simulated third-party property portal listing. In production the
// buyer arrives here from an existing portal via a "Book a viewing" deep link.
export default function ListingPage() {
  const photos = [property.heroPhoto, ...property.gallery];
  const [i, setI] = useState(0);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white sm:min-h-[calc(100dvh-3rem)]">
      {/* Fake portal chrome */}
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white">H</span>
          <span className="font-semibold text-indigo-700">{property.portal}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">demo portal</span>
        </div>
        <RestartButton />
      </header>

      <div className="relative">
        <Photo src={photos[i]} alt="Property photo" className="aspect-[4/3] w-full" />
        <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
          {i + 1} / {photos.length}
        </div>
        <button aria-label="Previous photo" onClick={() => setI((i - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow">‹</button>
        <button aria-label="Next photo" onClick={() => setI((i + 1) % photos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow">›</button>
        <span className="absolute left-3 top-3 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow">
          ✓ Self-viewing available
        </span>
      </div>

      <div className="flex-1 space-y-5 px-4 py-5">
        <div>
          <div className="text-2xl font-bold">{formatPrice(property.price)}</div>
          <div className="mt-1 text-slate-700">{property.title}</div>
          <div className="text-sm text-slate-500">
            {property.address}, {property.area}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          {[
            [property.beds, "beds"],
            [property.baths, "baths"],
            [`${property.sizeSqm} m²`, "size"],
            [property.energyRating, "energy"],
          ].map(([v, l]) => (
            <div key={l as string} className="rounded-xl bg-slate-50 py-2">
              <div className="font-semibold">{v}</div>
              <div className="text-xs text-slate-500">{l}</div>
            </div>
          ))}
        </div>

        <p className="text-sm leading-relaxed text-slate-600">{property.description}</p>

        <ul className="grid grid-cols-2 gap-2 text-sm">
          {property.highlights.map((h) => (
            <li key={h} className="flex items-center gap-1.5 text-slate-700">
              <span className="text-brand">●</span> {h}
            </li>
          ))}
        </ul>

        <div className="rounded-2xl bg-brand-light/60 p-4 text-sm text-teal-900">
          <div className="font-semibold">How self-viewing works</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Pick a time and verify your ID (2 min)</li>
            <li>Get a one-time door code by text</li>
            <li>Let yourself in — an AI assistant calls to guide you</li>
          </ol>
        </div>

        <div className="text-xs text-slate-400">Listed by {property.agency}</div>
      </div>

      <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
        <Link href="/book" className="btn-primary">
          Book a viewing
        </Link>
      </div>
    </div>
  );
}
