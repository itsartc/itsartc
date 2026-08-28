# Product decisions

A log of deliberate revisions to the founding product principles. Each entry
records what changed and why, so a later reader can tell an intentional
evolution from drift.

---

## D-001 — Camera: top-down 2D → fixed elevated angled 3D

**Date:** 2026-08-28
**Status:** Approved
**Supersedes:** Founding principle #2 ("Always top-down 2D")

### Old principle

> The camera is always top-down 2D and does not become third-person 3D.

### New principle

> The world is rendered in 3D using a fixed elevated, angled social-world
> camera. The camera must preserve the readability and easy navigation of the
> original top-down world while adding real 3D depth, visible building
> façades, player separation, lighting, signage, and spatial awareness. It is
> not a free-orbit camera and should not feel like a first-person,
> over-the-shoulder, or conventional third-person action game.

### Rationale

Real 3D depth makes building façades, entrances, signage and player spacing
legible in a way a flat top-down view cannot. That legibility is a commercial
requirement, not only an aesthetic one: sponsored buildings, company logos and
branded entrances must be visible from the default gameplay camera without the
player rotating anything.

### What this does NOT change

Every other founding principle stands unchanged:

- Desktop-first browser application, no install.
- Movement supports click-to-walk **and** arrow keys **and** WASD simultaneously.
- Clicking a person is information only; consequential actions need a second
  deliberate click.
- Proximity = conversation. No join button.
- The world remains structured, editable data — never a static image or
  hardcoded engine coordinates.
- Advertising/sponsorship surfaces stay designed into the world model.

### Camera constraints that follow

- Fixed elevated angle, roughly 45–55° downward.
- No free orbit, no player-controlled rotation, no FPS or over-the-shoulder framing.
- Never straight-down 90°.
- Building façades and signage must be readable from the default angle.

### Implementation

Delivered by the Phaser → Three.js renderer migration, beginning with the
parallel `/world3d` route (Phase 1).

---

## D-002 — Camera framing: whole-world fit → social range, yawed

**Date:** 2026-08-28
**Status:** Approved
**Refines:** D-001 (does not supersede it)

### Problem

The first Phase 1 camera satisfied D-001 arithmetically — 50° pitch, real
perspective projection — but still *read* as top-down when viewed. Three causes,
in order of impact:

1. **Whole-world framing.** The camera sat far enough back to fit all 64×46
   tiles. A 2.4-unit building against a 64-unit-wide frame is ~3% of the view;
   its façade was roughly 27 px tall on a 1280×800 screen. At that size a
   perspective view and an orthographic top-down view are visually
   indistinguishable. Framing, not angle, was the dominant factor.
2. **Zero yaw.** The camera sat exactly on the world's Z axis, so every
   axis-aligned building box presented a roof and exactly *one* flat face. One
   face plus a roof is the classic 2.5D-sprite silhouette; two faces is what the
   eye reads as a solid volume.
3. **Flat lighting.** With a single key light and strong hemisphere fill, the
   faces that were visible had too little tonal separation to describe form.

### Decision

The default camera frames a **social span (~32 tiles wide) around the spawn**,
not the whole map. Whole-world framing is retained as a *diagnostic* only, at
`/world3d?view=overview`, for comparing orientation against the 2D route.

The camera is additionally **yawed 20° off the world axis** so every building
shows two faces, and the key light is placed to the camera's left so those two
faces read at different values.

Yaw is small enough that map orientation is preserved — north stays up and every
building remains in the same screen quadrant as on `/world`.

### Constraints (unchanged from D-001)

Pitch stays within 45–55° (now 48°). No free orbit, no user-controlled rotation,
no over-the-shoulder framing, never straight down. Pitch and yaw are constants.

### Non-goals

This changes camera and framing only. World coordinates, world data, building
geometry, networking and the wire protocol are untouched.
