"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ThreePreview from "./ThreePreview";
import { WORLD_ASSET_BINDINGS } from "@/three/assets/catalog";
import type { CameraView } from "@/three/CameraRig";
import { WORLD_ASSETS, getWorldAsset, type AssetCategory } from "@/world/assetCatalog";
import type { Building, WorldMap, WorldObject } from "@/world/schema";
import { townCentral } from "@/world/townCentral";
import { cloneWorldMap, validateWorldMap } from "@/world/validation";

const DRAFT_KEY = "itsartc.admin.world.town-central.v1";

type Selection = { kind: "building" | "object"; id: string } | null;

const TERRAIN_COLOURS = {
  grass: "#66ab4d",
  grassdark: "#4f8e3f",
  path: "#5c6370",
  plaza: "#cbd0d7",
  water: "#3f97cf",
  sand: "#e0cd93",
};

const ASSET_COLOURS: Record<AssetCategory, string> = {
  building: "#60a5fa",
  skyscraper: "#818cf8",
  "background-building": "#94a3b8",
  attachment: "#64748b",
  "street-furniture": "#f59e0b",
  tree: "#22c55e",
  plant: "#84cc16",
  rock: "#a8a29e",
  landmark: "#f97316",
  fence: "#a16207",
  bridge: "#06b6d4",
};

function editorSeed(): WorldMap {
  const map = cloneWorldMap(townCentral);
  for (const building of map.buildings) {
    building.assetId = WORLD_ASSET_BINDINGS.buildings[building.id];
    building.rotation = 0;
  }
  for (const object of map.objects) {
    object.assetId = WORLD_ASSET_BINDINGS.objects[object.type];
    object.rotation = 0;
  }
  return map;
}

function isWorldMap(value: unknown): value is WorldMap {
  if (!value || typeof value !== "object") return false;
  const map = value as Partial<WorldMap>;
  return typeof map.id === "string" && typeof map.widthTiles === "number" &&
    typeof map.heightTiles === "number" && Array.isArray(map.buildings) &&
    Array.isArray(map.objects) && Array.isArray(map.terrain);
}

function nextId(prefix: string, existing: readonly { id: string }[]) {
  const used = new Set(existing.map((item) => item.id));
  let suffix = 1;
  while (used.has(`${prefix}-${suffix}`)) suffix++;
  return `${prefix}-${suffix}`;
}

export default function WorldEditor() {
  const [draft, setDraft] = useState<WorldMap>(() => editorSeed());
  const [previewMap, setPreviewMap] = useState<WorldMap>(() => editorSeed());
  const [previewView, setPreviewView] = useState<CameraView>("overview");
  const [selection, setSelection] = useState<Selection>(null);
  const [assetId, setAssetId] = useState<string>("city-commercial.building-a");
  const [category, setCategory] = useState<AssetCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("Local draft · not published");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    try {
      const parsed: unknown = JSON.parse(saved);
      if (!isWorldMap(parsed)) throw new Error("Draft is not a valid world document");
      setDraft(parsed);
      setPreviewMap(cloneWorldMap(parsed));
      setNotice("Recovered local draft");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not recover local draft");
    }
  }, []);

  const issues = useMemo(() => validateWorldMap(draft), [draft]);
  const errors = issues.filter((issue) => issue.severity === "error");
  const selectedAsset = getWorldAsset(assetId);
  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return WORLD_ASSETS.filter((asset) =>
      (category === "all" || asset.category === category) &&
      (!query || `${asset.label} ${asset.pack} ${asset.category}`.toLowerCase().includes(query)),
    );
  }, [category, search]);

  const selectedBuilding = selection?.kind === "building"
    ? draft.buildings.find((building) => building.id === selection.id)
    : undefined;
  const selectedObject = selection?.kind === "object"
    ? draft.objects.find((object) => object.id === selection.id)
    : undefined;

  const mutate = (change: (map: WorldMap) => void) => {
    setDraft((current) => {
      const next = cloneWorldMap(current);
      change(next);
      return next;
    });
    setNotice("Unsaved local changes");
  };

  const placeAsset = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedAsset?.editorReady || selectedAsset.placement === "attachment") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const tileX = Math.floor(((event.clientX - rect.left) / rect.width) * draft.widthTiles);
    const tileY = Math.floor(((event.clientY - rect.top) / rect.height) * draft.heightTiles);

    if (selectedAsset.placement === "building") {
      const { w, h } = selectedAsset.defaultFootprint;
      const x = Math.max(0, Math.min(draft.widthTiles - w, tileX - Math.floor(w / 2)));
      const y = Math.max(0, Math.min(draft.heightTiles - h, tileY - Math.floor(h / 2)));
      const id = nextId("b-editor", draft.buildings);
      const building: Building = {
        id,
        name: selectedAsset.label,
        districtId: draft.districts[0]?.id ?? "town-square",
        x, y, w, h,
        wallColor: "#53657d",
        roofColor: "#303846",
        enterable: false,
        status: "open",
        assetId: selectedAsset.id,
        rotation: 0,
      };
      mutate((map) => map.buildings.push(building));
      setSelection({ kind: "building", id });
      return;
    }

    const id = nextId("o-editor", draft.objects);
    const object: WorldObject = {
      id,
      type: selectedAsset.objectType ?? "rock",
      x: Math.max(0, Math.min(draft.widthTiles - selectedAsset.defaultFootprint.w, tileX)),
      y: Math.max(0, Math.min(draft.heightTiles - selectedAsset.defaultFootprint.h, tileY)),
      solid: selectedAsset.solidByDefault,
      assetId: selectedAsset.id,
      rotation: 0,
    };
    mutate((map) => map.objects.push(object));
    setSelection({ kind: "object", id });
  };

  const updateBuilding = (patch: Partial<Building>) => {
    if (!selectedBuilding) return;
    mutate((map) => {
      const building = map.buildings.find((item) => item.id === selectedBuilding.id);
      if (building) Object.assign(building, patch);
    });
  };

  const updateObject = (patch: Partial<WorldObject>) => {
    if (!selectedObject) return;
    mutate((map) => {
      const object = map.objects.find((item) => item.id === selectedObject.id);
      if (object) Object.assign(object, patch);
    });
  };

  const removeSelection = () => {
    if (!selection) return;
    mutate((map) => {
      if (selection.kind === "building") {
        map.buildings = map.buildings.filter((item) => item.id !== selection.id);
      } else {
        map.objects = map.objects.filter((item) => item.id !== selection.id);
      }
    });
    setSelection(null);
  };

  const saveDraft = () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setNotice(`Saved locally at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  };

  const exportDraft = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.id}-draft.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Exported world JSON");
  };

  const importDraft = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isWorldMap(parsed)) throw new Error("That file is not a world document");
      setDraft(parsed);
      setSelection(null);
      setNotice("Imported draft · save locally when ready");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import failed");
    }
  };

  const numberInput = (label: string, value: number, onChange: (value: number) => void) => (
    <label className="grid gap-1 text-xs text-slate-400">
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-md border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-400"
      />
    </label>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-900/95 px-5 py-4">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">itsartc admin</div>
            <h1 className="text-xl font-semibold">World builder · Town Central</h1>
            <p className="mt-1 text-xs text-slate-400">{notice}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button onClick={saveDraft} className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400">Save draft</button>
            <button onClick={exportDraft} className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/5">Export JSON</button>
            <button onClick={() => importRef.current?.click()} className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/5">Import</button>
            <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(event) => void importDraft(event.target.files?.[0])} />
            <button
              onClick={() => { const next = editorSeed(); setDraft(next); setPreviewMap(cloneWorldMap(next)); setSelection(null); setNotice("Reset to committed Town Central"); }}
              className="rounded-lg border border-red-400/30 px-3 py-2 text-red-200 hover:bg-red-400/10"
            >Reset</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1800px] gap-4 p-4 xl:grid-cols-[300px_minmax(620px,1fr)_320px]">
        <aside className="flex max-h-[calc(100vh-110px)] flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Asset library</h2>
              <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-300">{WORLD_ASSETS.length} verified</span>
            </div>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets…" className="mt-3 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400" />
            <select value={category} onChange={(event) => setCategory(event.target.value as AssetCategory | "all")} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm">
              <option value="all">All categories</option>
              {Array.from(new Set(WORLD_ASSETS.map((asset) => asset.category))).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Choose an asset, then click the map to place it. Gray assets are catalogued but wait for attachment anchors.</p>
          </div>
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3">
            {filteredAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                disabled={!asset.editorReady}
                onClick={() => setAssetId(asset.id)}
                className={`min-h-24 rounded-lg border p-2 text-left transition ${asset.id === assetId ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-slate-950 hover:border-white/25"} disabled:cursor-not-allowed disabled:opacity-35`}
              >
                <span className="mb-2 block h-7 w-7 rounded-md" style={{ background: ASSET_COLOURS[asset.category] }} />
                <span className="block text-xs font-medium leading-tight">{asset.label}</span>
                <span className="mt-1 block text-[10px] text-slate-500">{asset.category}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-slate-900 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Overhead construction canvas</h2>
                <p className="text-xs text-slate-400">{selectedAsset ? `Placement tool: ${selectedAsset.label}` : "Select an asset"}</p>
              </div>
              <div className="text-xs text-slate-400">{draft.widthTiles} × {draft.heightTiles} tiles</div>
            </div>
            <div
              role="application"
              aria-label="Town Central construction canvas"
              onClick={placeAsset}
              className="relative w-full cursor-crosshair overflow-hidden rounded-lg border border-white/15 bg-[#66ab4d] shadow-inner"
              style={{ aspectRatio: `${draft.widthTiles} / ${draft.heightTiles}` }}
            >
              {draft.terrain.map((region, index) => (
                <div key={`${region.type}-${index}`} className="pointer-events-none absolute" style={{ left: `${region.x / draft.widthTiles * 100}%`, top: `${region.y / draft.heightTiles * 100}%`, width: `${region.w / draft.widthTiles * 100}%`, height: `${region.h / draft.heightTiles * 100}%`, background: TERRAIN_COLOURS[region.type], opacity: 0.94 }} />
              ))}
              {draft.buildings.map((building) => (
                <button
                  key={building.id}
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setSelection({ kind: "building", id: building.id }); }}
                  className={`absolute overflow-hidden rounded-sm border text-[9px] font-semibold leading-tight shadow ${selection?.kind === "building" && selection.id === building.id ? "z-20 border-cyan-300 ring-2 ring-cyan-300/70" : "border-slate-900/60"}`}
                  style={{ left: `${building.x / draft.widthTiles * 100}%`, top: `${building.y / draft.heightTiles * 100}%`, width: `${building.w / draft.widthTiles * 100}%`, height: `${building.h / draft.heightTiles * 100}%`, background: building.wallColor }}
                  title={building.name}
                ><span className="line-clamp-2 px-1 text-white drop-shadow">{building.name}</span></button>
              ))}
              {draft.objects.map((object) => {
                const asset = getWorldAsset(object.assetId);
                const width = asset?.defaultFootprint.w ?? (object.type === "fountain" ? 2 : 1);
                const height = asset?.defaultFootprint.h ?? (object.type === "fountain" ? 2 : 1);
                return (
                  <button
                    key={object.id}
                    type="button"
                    onClick={(event) => { event.stopPropagation(); setSelection({ kind: "object", id: object.id }); }}
                    className={`absolute z-10 rounded-full border border-slate-950/60 shadow ${selection?.kind === "object" && selection.id === object.id ? "ring-2 ring-cyan-300" : ""}`}
                    style={{ left: `${object.x / draft.widthTiles * 100}%`, top: `${object.y / draft.heightTiles * 100}%`, width: `${Math.max(width / draft.widthTiles * 100, 0.8)}%`, height: `${Math.max(height / draft.heightTiles * 100, 1.1)}%`, background: asset ? ASSET_COLOURS[asset.category] : "#fbbf24" }}
                    title={`${object.type} · ${object.id}`}
                  />
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Live Three.js preview</h2>
                <p className="text-xs text-slate-400">Overhead for editing; first-person for player-scale validation.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPreviewView("overview")} className={`rounded-md px-3 py-1.5 text-xs ${previewView === "overview" ? "bg-cyan-500 text-slate-950" : "bg-slate-800"}`}>Overhead</button>
                <button onClick={() => setPreviewView("first-person")} className={`rounded-md px-3 py-1.5 text-xs ${previewView === "first-person" ? "bg-cyan-500 text-slate-950" : "bg-slate-800"}`}>First person</button>
                <button disabled={errors.length > 0} onClick={() => setPreviewMap(cloneWorldMap(draft))} className="rounded-md border border-white/15 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40">Refresh</button>
              </div>
            </div>
            <ThreePreview map={previewMap} view={previewView} />
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-slate-900 p-4">
            <h2 className="font-semibold">Inspector</h2>
            {!selectedBuilding && !selectedObject && <p className="mt-3 text-sm text-slate-400">Select a building or object on the construction canvas.</p>}

            {selectedBuilding && (
              <div className="mt-3 space-y-3">
                <label className="grid gap-1 text-xs text-slate-400">Name<input value={selectedBuilding.name} onChange={(event) => updateBuilding({ name: event.target.value })} className="rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-sm text-white" /></label>
                <div className="grid grid-cols-2 gap-2">
                  {numberInput("X", selectedBuilding.x, (x) => updateBuilding({ x }))}
                  {numberInput("Y", selectedBuilding.y, (y) => updateBuilding({ y }))}
                  {numberInput("Width", selectedBuilding.w, (w) => updateBuilding({ w: Math.max(1, w) }))}
                  {numberInput("Depth", selectedBuilding.h, (h) => updateBuilding({ h: Math.max(1, h) }))}
                </div>
                <label className="grid gap-1 text-xs text-slate-400">District<select value={selectedBuilding.districtId} onChange={(event) => updateBuilding({ districtId: event.target.value })} className="rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-sm text-white">{draft.districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}</select></label>
                <div className="flex gap-2">
                  <button onClick={() => updateBuilding({ rotation: (((selectedBuilding.rotation ?? 0) + 90) % 360) as 0 | 90 | 180 | 270 })} className="flex-1 rounded-md bg-slate-800 px-3 py-2 text-xs">Rotate 90°</button>
                  <button onClick={() => {
                    const enterable = !selectedBuilding.enterable;
                    updateBuilding({ enterable, entrance: enterable ? { x: selectedBuilding.x + Math.floor(selectedBuilding.w / 2), y: Math.min(draft.heightTiles - 1, selectedBuilding.y + selectedBuilding.h) } : undefined });
                  }} className={`flex-1 rounded-md px-3 py-2 text-xs ${selectedBuilding.enterable ? "bg-emerald-500 text-slate-950" : "bg-slate-800"}`}>{selectedBuilding.enterable ? "Enterable" : "Closed"}</button>
                </div>
              </div>
            )}

            {selectedObject && (
              <div className="mt-3 space-y-3">
                <div className="rounded-lg bg-slate-950 p-3 text-xs"><div className="font-medium text-white">{getWorldAsset(selectedObject.assetId)?.label ?? selectedObject.type}</div><div className="mt-1 text-slate-500">{selectedObject.id}</div></div>
                <div className="grid grid-cols-2 gap-2">
                  {numberInput("X", selectedObject.x, (x) => updateObject({ x }))}
                  {numberInput("Y", selectedObject.y, (y) => updateObject({ y }))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateObject({ rotation: (((selectedObject.rotation ?? 0) + 90) % 360) as 0 | 90 | 180 | 270 })} className="flex-1 rounded-md bg-slate-800 px-3 py-2 text-xs">Rotate 90°</button>
                  <button onClick={() => updateObject({ solid: !selectedObject.solid })} className={`flex-1 rounded-md px-3 py-2 text-xs ${selectedObject.solid ? "bg-amber-400 text-slate-950" : "bg-slate-800"}`}>{selectedObject.solid ? "Solid" : "Walk-through"}</button>
                </div>
              </div>
            )}

            {selection && <button onClick={removeSelection} className="mt-4 w-full rounded-md border border-red-400/30 px-3 py-2 text-xs text-red-200 hover:bg-red-400/10">Delete selected</button>}
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Publish readiness</h2>
              <span className={`rounded-full px-2 py-1 text-[11px] ${errors.length ? "bg-red-400/10 text-red-300" : "bg-emerald-400/10 text-emerald-300"}`}>{errors.length ? `${errors.length} blocked` : "Ready"}</span>
            </div>
            {issues.length === 0 ? <p className="mt-3 text-sm text-slate-400">All entrances are reachable and the current layout passes structural checks.</p> : (
              <ul className="mt-3 space-y-2 text-xs">{issues.map((issue, index) => <li key={`${issue.code}-${issue.entityId}-${index}`} className="rounded-md bg-red-400/10 p-2 text-red-200">{issue.message}</li>)}</ul>
            )}
            <div className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-500">Publishing is intentionally disabled until admin authentication and server-side validation are connected. Local drafts cannot affect the live world.</div>
          </div>
        </aside>
      </div>
    </main>
  );
}
