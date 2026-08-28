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
