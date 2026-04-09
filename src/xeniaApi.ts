import * as http from 'http';
import { Logger } from 'homebridge';

export interface XeniaOverview {
  MA_EXTRACTIONS: number;
  MA_OPERATING_HOURS: number;
  MA_STATUS: number;       // 0=off, 1=on, 2=eco
  MA_CUR_PWR: number;
  MA_ENERGY_TOTAL_KWH: number;
  BG_SENS_TEMP_A: number;  // brew group temperature
  BG_LEVEL_PW_CONTROL: number;
  PU_SENS_PRESS: number;
  SB_SENS_PRESS: number;   // steam boiler pressure
  BB_SENS_TEMP_A: number;  // brew boiler temperature
  BB_LEVEL_PW_CONTROL: number;
  SB_STATUS: number;       // steam boiler on/off
  MA_LAST_EXTRACTION_ML: string;
}

export interface XeniaOverviewSingle {
  BG_SET_TEMP: number;
  PU_SET_PRESS: number;
  PU_SENS_WATER_TANK_LEVEL: number; // 0=empty, 1=ok
  SB_SET_PRESS: number;
  BB_SET_TEMP: number;     // brew boiler target temperature
  PSP: number;
  MA_MAC: string;
}

/**
 * HTTP client for the Xenia ESP32 API v2.
 * Uses Node.js native http module — no external dependencies.
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
        res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
      });

      req.on('error', (e) => reject(e));
      req.setTimeout(8000, () => {
        req.abort();
      });
      if (data) { req.write(data); }
      req.end();
    });
  }

  private async get<T>(path: string): Promise<T | null> {
    try {
      return await this.request('GET', path) as T;
    } catch (e) {
      this.log.warn('[XeniaAPI] GET error ' + path + ': ' + (e as Error).message);
      return null;
    }
  }

  private async post(path: string, body: object): Promise<boolean> {
    try {
      await this.request('POST', path, body);
      return true;
    } catch (e) {
      this.log.warn('[XeniaAPI] POST error ' + path + ': ' + (e as Error).message);
      return false;
    }
  }

  /** Full overview: temperatures, pressure, status */
  async getOverview(): Promise<XeniaOverview | null> {
    return this.get<XeniaOverview>('/overview');
  }

  /** Settings: target temperatures, water tank level */
  async getOverviewSingle(): Promise<XeniaOverviewSingle | null> {
    return this.get<XeniaOverviewSingle>('/overview_single');
  }

  /** Machine control: 0=off, 1=on, 2=eco, 3=steam off, 4=steam on, 5=on+steam off */
  async control(action: number): Promise<boolean> {
    return this.post('/machine/control/', { action });
  }

  /** Toggle steam boiler on/off */
  async toggleSteamBoiler(on: boolean): Promise<boolean> {
    return this.post('/toggle_sb', { TOGGLE: on });
  }

  /** Set brew group + brew boiler target temperature */
  async setTemperatures(bgTemp: number, bbTemp: number): Promise<boolean> {
    return this.post('/inc_dec', { BG_SET_TEMP: bgTemp, BB_SET_TEMP: bbTemp });
  }

  /** Execute a script on the machine */
  async executeScript(scriptId: number): Promise<boolean> {
    return this.post('/scripts/execute/', { ID: String(scriptId) });
  }
}
