# homebridge-xenia-espresso

[![npm version](https://badge.fury.io/js/homebridge-xenia-espresso.svg)](https://badge.fury.io/js/homebridge-xenia-espresso)

Homebridge plugin voor de **Xenia espressomachine** (DB / HX) met ESP32 WiFi module. Bestuur je machine rechtstreeks vanuit de Apple Home app of via Siri.

## Functies

- ☕ Machine aan/uit schakelen
- 💨 Stoomboiler apart aan/uit
- 🌿 ECO modus activeren
- 🔄 Automatische status polling (geen cloud, volledig lokaal)

## Vereisten

- Homebridge v2.0 of hoger
- Node.js v18 of hoger
- Xenia espressomachine met ESP32 WiFi module (firmware met API v2)
- Machine en Homebridge op hetzelfde lokale netwerk

## Installatie

```bash
npm install -g homebridge-xenia-espresso
```

Of via de Homebridge UI: zoek op `homebridge-xenia-espresso`.

## Configuratie

Voeg het volgende toe aan je Homebridge `config.json`:

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

### Opties

| Optie | Type | Standaard | Beschrijving |
|-------|------|-----------|--------------|
| `ip` | string | — | **Verplicht.** IP-adres van de machine op je netwerk |
| `pollInterval` | number | `30` | Polling interval in seconden (5–300) |

## IP-adres vinden

Kijk in de display van de machine of in je router/DHCP lijst. Stel bij voorkeur een vast IP-adres in via DHCP reservering.

## Ontwikkeling

```bash
git clone https://github.com/JOUWGEBRUIKERSNAAM/homebridge-xenia-espresso.git
cd homebridge-xenia-espresso
npm install
npm run build
npm link
```

In je Homebridge config map:
```bash
npm link homebridge-xenia-espresso
```

## API

Deze plugin gebruikt de officiële Xenia REST API v2:
- `GET  /api/v2/machine/status/` — machinestatus ophalen
- `POST /api/v2/machine/control/` — machine besturen
- `POST /api/v2/scripts/execute/` — script uitvoeren
- `GET  /api/v2/scripts/stop` — script stoppen

Zie [xenia-espresso.de/api.html](https://www.xenia-espresso.de/api.html) voor de volledige API documentatie.

## Licentie

Apache-2.0
