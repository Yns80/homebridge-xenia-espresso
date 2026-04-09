import * as http from 'http';
import { Logger } from 'homebridge';

export interface XeniaOverview {
  MA_EXTRACTIONS: number;
  MA_OPERATING_HOURS: number;
  MA_STATUS: number;       // 0=uit, 1=aan, 2=eco
  MA_CUR_PWR: number;
  MA_ENERGY_TOTAL_KWH: number;
  BG_SENS_TEMP_A: number;  // brewgroup temperatuur
  BG_LEVEL_PW_CONTROL: number;
  PU_SENS_PRESS: number;
  SB_SENS_PRESS: number;   // stoomboiler druk
  BB_SENS_TEMP_A: number;  // koffieboiler temperatuur
  BB_LEVEL_PW_CONTROL: number;
  SB_STATUS: number;       // stoomboiler aan/uit
  MA_LAST_EXTRACTION_ML: string;
}

export interface XeniaOverviewSingle {
  BG_SET_TEMP: number;
  PU_SET_PRESS: number;
  PU_SENS_WATER_TANK_LEVEL: number; // 0=leeg, 1=vol
  SB_SET_PRESS: number;
  BB_SET_TEMP: number;     // koffieboiler doeltemperatuur
  PSP: number;
  MA_MAC: string;
}

/**
 * HTTP client voor de Xenia ESP32 API v2.
 * Gebruikt Node.js native http module — geen externe dependencies.
 */
export class XeniaApi {
  constructor(private readonly ip: string, private readonly log: Logger) {}

  private request(method: string, path: string, body?: object): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : undefined;
      const opts: http.RequestOptions = {
        hostname: this.ip,
        port: 80,
        path: '/api/v2' + path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      };

      const req = http.request(opts, (res) => {
        let raw = '';
        res.on('data', (chunk: string) => { raw += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
      if (data) { req.write(data); }
      req.end();
    });
  }

  private async get<T>(path: string): Promise<T | null> {
    try {
      return await this.request('GET', path) as T;
    } catch (e) {
      this.log.error(`[XeniaAPI] GET fout ${path}:`, e);
      return null;
    }
  }

  private async post(path: string, body: object): Promise<boolean> {
    try {
      await this.request('POST', path, body);
      return true;
    } catch (e) {
      this.log.error(`[XeniaAPI] POST fout ${path}:`, e);
      return false;
    }
  }

  /** Volledig overzicht: temperaturen, druk, status */
  async getOverview(): Promise<XeniaOverview | null> {
    return this.get<XeniaOverview>('/overview');
  }

  /** Instellingen: doeltemperaturen, waterreservoir */
  async getOverviewSingle(): Promise<XeniaOverviewSingle | null> {
    return this.get<XeniaOverviewSingle>('/overview_single');
  }

  /** Machine besturen: 0=uit, 1=aan, 2=eco, 3=stoom uit, 4=stoom aan, 5=aan+stoom uit */
  async control(action: number): Promise<boolean> {
    return this.post('/machine/control/', { action });
  }

  /** Stoomboiler aan/uit via toggle endpoint */
  async toggleSteamBoiler(on: boolean): Promise<boolean> {
    return this.post('/toggle_sb', { TOGGLE: on });
  }

  /** Brewgroup + koffieboiler doeltemperatuur instellen */
  async setTemperatures(bgTemp: number, bbTemp: number): Promise<boolean> {
    return this.post('/inc_dec', { BG_SET_TEMP: bgTemp, BB_SET_TEMP: bbTemp });
  }

  /** Script uitvoeren op de machine */
  async executeScript(scriptId: number): Promise<boolean> {
    return this.post('/scripts/execute/', { ID: String(scriptId) });
  }
}
