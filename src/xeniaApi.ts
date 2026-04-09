import { Logger } from 'homebridge';

export interface XeniaStatus {
  MA_STATUS: number; // 0=uit, 1=aan, 2=eco
}

export interface XeniaOverview {
  MA_EXTRACTIONS: number;
  MA_OPERATING_HOURS: number;
  MA_STATUS: number;
  MA_CUR_PWR: number;
  MA_ENERGY_TOTAL_KWH: number;
  BG_SENS_TEMP_A: number;      // brewgroup temperatuur
  BG_LEVEL_PW_CONTROL: number;
  PU_SENS_PRESS: number;       // pomp druk
  SB_SENS_PRESS: number;       // stoomboiler druk
  BB_SENS_TEMP_A: number;      // koffieboiler temperatuur (actueel)
  BB_LEVEL_PW_CONTROL: number;
  SB_STATUS: number;           // stoomboiler aan/uit
  MA_LAST_EXTRACTION_ML: string;
}

export interface XeniaOverviewSingle {
  BG_SET_TEMP: number;         // brewgroup doeltemperatuur
  PU_SET_PRESS: number;        // pomp doeldruk
  PU_SENS_WATER_TANK_LEVEL: number; // 0=leeg, 1=vol
  SB_SET_PRESS: number;        // stoomboiler doeldruk
  BB_SET_TEMP: number;         // koffieboiler doeltemperatuur
  PSP: number;
  MA_MAC: string;
}

/**
 * HTTP client voor de Xenia ESP32 API v2.
 */
export class XeniaApi {
  private readonly baseUrl: string;

  constructor(ip: string, private readonly log: Logger) {
    this.baseUrl = `http://${ip}/api/v2`;
  }

  private async get<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        this.log.warn(`[XeniaAPI] GET ${path} mislukt: HTTP ${res.status}`);
        return null;
      }
      return await res.json() as T;
    } catch (err) {
      this.log.error(`[XeniaAPI] Verbindingsfout bij GET ${path}:`, err);
      return null;
    }
  }

  private async post(path: string, body: object): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        this.log.warn(`[XeniaAPI] POST ${path} mislukt: HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (err) {
      this.log.error(`[XeniaAPI] Verbindingsfout bij POST ${path}:`, err);
      return false;
    }
  }

  /** Machinestatus (aan/uit/eco) */
  async getStatus(): Promise<XeniaStatus | null> {
    return this.get<XeniaStatus>('/status');
  }

  /** Volledig overzicht: temperaturen, druk, waterstand, energie */
  async getOverview(): Promise<XeniaOverview | null> {
    return this.get<XeniaOverview>('/overview');
  }

  /** Instellingen: doeltemperaturen, waterreservoir, MAC */
  async getOverviewSingle(): Promise<XeniaOverviewSingle | null> {
    return this.get<XeniaOverviewSingle>('/overview_single');
  }

  /** Machine aan/uit/eco besturen (action 0-5) */
  async control(action: number): Promise<boolean> {
    return this.post('/machine/control/', { action });
  }

  /** Stoomboiler aan/uit */
  async toggleSteamBoiler(on: boolean): Promise<boolean> {
    return this.post('/toggle_sb', { TOGGLE: on });
  }

  /** Koffieboiler temperatuur aanpassen (+0.1 of -0.1 per stap) */
  async setBrewBoilerTemp(temp: number): Promise<boolean> {
    return this.post('/inc_dec_bb', { BB_SET_TEMP: temp });
  }

  /** Brewgroup + koffieboiler doeltemperatuur direct instellen */
  async setTemperatures(bgTemp: number, bbTemp: number): Promise<boolean> {
    return this.post('/inc_dec', { BG_SET_TEMP: bgTemp, BB_SET_TEMP: bbTemp });
  }

  /** Script uitvoeren */
  async executeScript(scriptId: number): Promise<boolean> {
    return this.post('/scripts/execute/', { ID: String(scriptId) });
  }

  /** Script stoppen */
  async stopScript(): Promise<boolean> {
    return this.get<object>('/scripts/stop') !== null;
  }
}
