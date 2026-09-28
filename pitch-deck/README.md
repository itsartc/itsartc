# Pitch Deck — 3D Studio

A responsive web app that recreates a 3D character design studio: a real-time
Three.js scene (a clay-style boy with glasses and a crossbody bag) wrapped in a
clean editor UI.

## Features

- **Scene panel** – layers (camera, lights, objects), lock / hide / focus, rename the project, Assets tab, ⌘K search
- **Viewport** – orbit, zoom and pan with mouse or touch; click the model to select a layer
- **Toolbar** – select / orbit / comment pins / 4:5 frame guide, turntable play, zoom presets, undo & redo (⌘Z / ⇧⌘Z), PNG export
- **Design panel** – materials applied to the selected object, style presets that relight the scene, background colour and opacity, isometric (orthographic) or perspective camera with a distortion (FOV) slider
- **Animation panel** – turntable, idle breathing and a wave
- **Prompt bar** – add photos, 3D objects or files; inspiration prompts; model picker (the responses are simulated, there's no AI backend)
- **Responsive** – three columns on desktop; on tablets and phones the side panels become slide-in drawers

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Built with Vite, React 18, TypeScript and Three.js. Deploys to Vercel with zero config (`vercel.json`).
