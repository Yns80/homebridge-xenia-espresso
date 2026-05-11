# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

`homebridge-xenia-espresso` — a [Homebridge](https://homebridge.io) dynamic
platform plugin that exposes a **Xenia espresso machine** (DB / HX) with an
ESP32 WiFi module to Apple HomeKit. Communication is **100% local** over the
machine's HTTP REST API v2 — there is no cloud dependency.

Written in TypeScript, compiled to CommonJS in `dist/`. Published to npm as
`homebridge-xenia-espresso`.

## Layout

```
src/
  index.ts       Entry point — registers the platform with Homebridge
  settings.ts     Constants: PLUGIN_NAME, PLATFORM_NAME, XeniaAction enum
  platform.ts     XeniaPlatform — DynamicPlatformPlugin; discovers the machine,
                  creates/restores the single accessory keyed by IP-derived UUID
  accessory.ts    XeniaMachineAccessory — all HomeKit services + status polling
  xeniaApi.ts     XeniaApi — raw `http`-module REST client for the Xenia API
dist/             Compiled JS + .d.ts + sourcemaps (COMMITTED — see CI below)
config.schema.json   Homebridge UI config form definition
.github/workflows/   build.yml (build + commit dist), publish.yml (npm publish)
```

There are **no tests** and **no linter** configured. `dist/` is intentionally
committed to the repo (it is not in `.gitignore`).

## Build / dev workflow

```bash
npm install
npm run build      # tsc -> dist/
npm run watch      # tsc --watch
```

There is no test or lint script. After changing anything in `src/`, run
`npm run build` so `dist/` stays in sync — the published package and the
committed `dist/` both depend on it. CI (`build.yml`) also rebuilds and commits
`dist/` back to `main` on push, but keep it current locally too.

To test against a real Homebridge install: `npm link`, then `npm link
homebridge-xenia-espresso` in the Homebridge config directory.

## Release / publish

1. Bump `version` in `package.json` (commit message style: `Bump to X.Y.Z`).
2. Push to `main`. `build.yml` rebuilds and commits `dist/`.
3. Create a GitHub Release. `publish.yml` runs `npm publish --access public
   --provenance` using **OIDC trusted publishing** (no npm token stored;
   requires Node 24 / npm 11+, which the workflow sets up). `workflow_dispatch`
   can also trigger it manually.

## How the plugin works

- **Single accessory.** `platform.ts` builds one `PlatformAccessory` with a
  stable UUID derived from the configured `ip` (`xenia-espresso-${ip}`). All
  functionality lives on that one accessory as multiple services.
- **HomeKit services** (all defined in `accessory.ts`, each with a fixed
  subtype string so they survive cache restores):
  | Service | Subtype | Source field |
  |---|---|---|
  | Switch "Espresso Machine" | `main-switch` | `MA_STATUS` (on/eco/off) |
  | Switch "Steam Boiler" | `steam-switch` | `SB_STATUS` |
  | Switch "ECO Mode" | `eco-switch` | `MA_STATUS == 2` |
  | TemperatureSensor "Brew Boiler Temperature" | `brew-boiler-temp` | `BB_SENS_TEMP_A` |
  | TemperatureSensor "Brew Group Temperature" | `brew-group-temp` | `BG_SENS_TEMP_A` |
  | Thermostat "Boiler Target Temperature" | `thermostat` | `BB_SET_TEMP` (read) / power state |
  | Water Tank (FilterMaintenance / ContactSensor / LeakSensor — configurable) | `water-filter` / `water-contact` / `water-sensor` | `PU_SENS_WATER_TANK_LEVEL == 0` |
  | TemperatureSensor "Steam Boiler Pressure" | `steam-pressure` | `SB_SENS_PRESS` (bar, shown as °C) |
  | TemperatureSensor "Pump Pressure" | `pump-pressure` | `PU_SENS_PRESS` (bar, shown as °C) |
  | AccessoryInformation | — | firmware/hardware revision fields repurposed to show shots / hours / power |
- **Polling.** `pollStatus()` runs once at startup and then every
  `pollInterval` seconds (default 30, range 5–300). It fetches `/overview` and
  `/overview_single` in parallel and only calls `updateCharacteristic` when a
  value actually changed (avoids HomeKit log spam).
- **Stale-service cleanup.** When `waterTankSensor` config changes, or when an
  older plugin version used a different service type for the pressure tiles,
  the constructor removes the now-unused services from the cached accessory.
  Preserve this logic when adding/changing services — use `getServiceById` (not
  `getService`) for lookups so Homebridge 2.x doesn't crash on duplicate UUIDs.

## Xenia API quirks (xeniaApi.ts)

The REST API is implemented over Node's raw `http` module (no fetch/axios — no
runtime dependencies). Important behaviors that are easy to break:

- Base path is `/api/v2`, port 80, plain HTTP.
- **POST requests must use `Content-Type: application/x-www-form-urlencoded`**
  but send a **JSON body**, and every value must be a **string**
  (e.g. `{"action":"1"}`, not `{"action":1}`). GET uses
  `Content-Type: application/json`.
- The machine **resets the socket (`ECONNRESET`/`EPIPE`) after responding to a
  POST** — this is normal; those error codes are swallowed silently. POST is
  treated as fire-and-forget (`post()` always resolves `true`).
- Requests time out at 8 s; on any other error the request resolves to `{}` and
  `get()` returns `null` (logged as a warning). Callers must tolerate `null`.
- Status enums are not 0/1: `MA_STATUS` 0=OFF 1=ON 2=ECO 3=BREWING 4=DRAINING;
  `SB_STATUS` **1=OFF 2=ON**. Use the `MachineStatus` / `SteamBoilerStatus`
  constants, not literals.
- `MA_OPERATING_HOURS` is in **minutes**; `MA_LAST_EXTRACTION_ML` is a string.

Endpoints used: `GET /overview`, `GET /overview_single`, `GET /machine`,
`GET /scripts/list`, `POST /machine/control/`, `POST /toggle_sb`,
`POST /inc_dec`, `POST /inc_dec_bb`, `POST /scripts/execute/`. See
<https://www.xenia-espresso.de/api.html>.

## Conventions

- **Strict TypeScript** (`strict`, `noImplicitAny`). Target/lib ES2022,
  module CommonJS. `index.ts` uses `export = ` (CommonJS-style) as Homebridge
  requires.
- Existing code comments and many log strings are in **Dutch** (mixed with
  English identifiers). Match the surrounding style of the file you edit; new
  user-facing log strings are fine in either, but stay consistent within a file.
- Config keys (`config.schema.json` ↔ `platform.ts` ↔ `accessory.ts`) must
  stay in sync: `name`, `ip`, `pollInterval`, `waterTankSensor`.
- `PLUGIN_NAME` in `settings.ts` must equal `name` in `package.json`;
  `PLATFORM_NAME` must equal `pluginAlias` in `config.schema.json`.
- No new runtime dependencies without good reason — the plugin currently has
  zero `dependencies`.

## Git / branching

- Feature work for AI-assisted changes goes on the branch you were assigned
  (e.g. `claude/...`); never push to `main` directly.
- Commit messages are short and imperative (`Bump to 0.5.4`, `Use getServiceById
  for service lookups (fix HB 2.x duplicate-UUID crash)`).
- Always run `npm run build` and commit the updated `dist/` alongside `src/`
  changes (CI will also do it, but a clean local diff is expected).
