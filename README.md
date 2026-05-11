# homebridge-xenia-espresso

[![npm version](https://badge.fury.io/js/homebridge-xenia-espresso.svg)](https://badge.fury.io/js/homebridge-xenia-espresso)

Homebridge plugin for the **Xenia espresso machine** (DB / HX) with ESP32 WiFi module. Control your machine straight from the Apple Home app or via Siri.

## Features

- ☕ Turn the machine on/off
- 💨 Steam boiler on/off separately
- 🌿 Activate ECO mode
- 🌡️ Brew boiler / brew group temperatures, target-temperature thermostat
- 💧 Water-tank low warning, steam-boiler & pump pressure tiles
- 📜 Run machine scripts from a button (pressure profiles, pre-infusion, …) — plus a generic "Stop Script" button
- 🔄 Automatic status polling (no cloud — fully local)

## Requirements

- Homebridge v2.0 or newer
- Node.js v18 or newer
- Xenia espresso machine with ESP32 WiFi module (firmware with API v2)
- Machine and Homebridge on the same local network

## Installation

```bash
npm install -g homebridge-xenia-espresso
```

Or via the Homebridge UI: search for `homebridge-xenia-espresso`.

## Configuration

Add the following to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "XeniaEspresso",
      "name": "Xenia Espresso",
      "ip": "192.168.1.100",
      "pollInterval": 30
    }
  ]
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ip` | string | — | **Required.** Local IP address of the machine on your network |
| `pollInterval` | number | `30` | Status polling interval in seconds (5–300) |
| `waterTankSensor` | string | `filter` | How a low water tank shows up in HomeKit: `filter` / `contact` / `leak` / `none` |
| `exposeScripts` | boolean | `true` | Create a button in HomeKit for every script stored on the machine. Pressing it runs the script. Create the scripts on the machine first |

### Scripts as buttons

The Xenia supports **scripts** that can do things like a full pressure profile
or a pre-infusion. Create the script on the machine first (via the
[script editor](https://www.xenia-espresso.de) / the display). The plugin then
automatically creates a momentary switch ("button") in the Home app for each
script — press it and the machine runs the script, then the button flips back
off. It also adds a single generic **"Stop Script"** button that aborts
whichever script is currently running. On startup the plugin logs the available
scripts (id → name). Set `exposeScripts` to `false` if you don't want script
buttons.

> The plugin cannot *create* scripts — the Xenia API has no endpoint for that;
> you author them on the machine.

## Finding the IP address

Check the machine's display or your router/DHCP list. Preferably set a static IP
via a DHCP reservation.

## Development

```bash
git clone https://github.com/Yns80/homebridge-xenia-espresso.git
cd homebridge-xenia-espresso
npm install
npm run build
npm link
```

In your Homebridge config directory:
```bash
npm link homebridge-xenia-espresso
```

## API

This plugin uses the official Xenia REST API v2:
- `GET  /api/v2/overview` — temperatures, pressures, machine status
- `POST /api/v2/machine/control/` — control the machine (on / off / ECO / steam boiler)
- `GET  /api/v2/scripts/list` — list user scripts
- `POST /api/v2/scripts/execute/` — run a script
- `GET  /api/v2/scripts/stop` — stop the running script

See [xenia-espresso.de/api.html](https://www.xenia-espresso.de/api.html) for the full API documentation.

## License

Apache-2.0
