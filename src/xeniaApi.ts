import * as http from 'http';
import { Logger } from 'homebridge';

// MA_STATUS values
export const MachineStatus = { OFF: 0, ON: 1, ECO: 2, BREWING: 3, DRAINING: 4 } as const;
// SB_STATUS values — NOTE: OFF=1, ON=2 (not 0/1)
export const SteamBoilerStatus = { OFF: 1, ON: 2 } as const;

export interface XeniaOverview {
  MA_EXTRACTIONS: number;
  MA_OPERATING_HOURS: number;   // in minutes
  MA_STATUS: number;            // 0=off, 1=on, 2=eco, 3=brewing, 4=draining
  MA_CLOCK: number;
  MA_CUR_PWR: number;           // watts
  MA_MAX_PWR: number;
  MA_ENERGY_TOTAL_KWH: number;
  MA_LAST_EXTRACTION_ML: string;
  BG_SENS_TEMP_A: number;       // brew group temperature (°C)
  BG_LEVEL_PW_CONTROL: number;
  BB_SENS_TEMP_A: number;       // brew boiler temperature (°C)
  BB_LEVEL_PW_CONTROL: number;
  PU_SENS_PRESS: number;        // pump pressure (bar)
  PU_LEVEL_PW_CONTROL: number;
  PU_SET_LEVEL_PW_CONTROL: number;
  PU_SENS_FLOW_METER_ML: number; // real-time flow meter (ml)
  SB_SENS_PRESS: number;        // steam boiler pressure (bar)
  SB_STATUS: number;            // 1=off, 2=on
  SCALE_WEIGHT: number;         // scale weight (g)
}

export interface XeniaOverviewSingle {
  BG_SET_TEMP: number;
  BB_SET_TEMP: number;          // brew boiler target temperature
  PU_SET_PRESS: number;
  SB_SET_PRESS: number;
  PU_SENS_WATER_TANK_LEVEL: number; // 0=empty, 1=ok
  MA_EXTRACTIONS_START: number;
  PSP: number;
  MA_MAC: string;
  POP_UP: number | null;
}

export interface XeniaMachine {
  MA_TYPE: string;
  MA_MAIN_FW: string;
  MA_ESP_FW: string;
}

export class XeniaApi {
  constructor(private readonly ip: string, private readonly log: Logger) {}

  private request(method: string, path: string, body?: object): Promise<unknown> {
    return new Promise((resolve) => {
      const data = body ? JSON.stringify(body) : undefined;
      // POST: Xenia requires JSON body with application/x-www-form-urlencoded Content-Type
      const contentType = method === 'POST'
        ? 'application/x-www-form-urlencoded'
        : 'application/json';

      const opts: http.RequestOptions = {
        hostname: this.ip,
        port: 80,
        path: '/api/v2' + path,
        method,
        headers: {
          'Content-Type': contentType,
          'Connection': 'close',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
        agent: false,
      };

      const req = http.request(opts, (res) => {
        let raw = '';
        res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
      });

      // ECONNRESET/EPIPE are expected on POST — Xenia closes the socket after responding
      req.on('error', (e: NodeJS.ErrnoException) => {
        if (e.code !== 'ECONNRESET' && e.code !== 'EPIPE') {
          this.log.warn('[XeniaAPI] Request error on ' + method + ' ' + path + ': ' + e.message);
        }
        resolve({});
      });
      req.setTimeout(8000, () => { req.destroy(); resolve({}); });
      if (data) { req.write(data); }
      req.end();
    });
  }

  private async get<T>(path: string): Promise<T | null> {
    const r = await this.request('GET', path) as Record<string, unknown>;
    if (Object.keys(r).length === 0) {
      this.log.warn('[XeniaAPI] No data from GET ' + path);
      return null;
    }
    return r as T;
  }

  private async post(path: string, body: object): Promise<boolean> {
    await this.request('POST', path, body);
    return true;
  }

  /** Full overview: temperatures, pressure, status, flow, scale */
  async getOverview(): Promise<XeniaOverview | null> { return this.get<XeniaOverview>('/overview'); }

  /** Settings: target temperatures, water tank level */
  async getOverviewSingle(): Promise<XeniaOverviewSingle | null> { return this.get<XeniaOverviewSingle>('/overview_single'); }

  /** Machine type and firmware versions */
  async getMachine(): Promise<XeniaMachine | null> { return this.get<XeniaMachine>('/machine'); }

  /** List user scripts: returns { id: name } */
  async getScripts(): Promise<Record<number, string> | null> { return this.get('/scripts/list'); }

  /** Machine control — action codes:
   *  0=OFF, 1=ON (with steam), 2=ECO, 3=SB_OFF, 4=SB_ON, 5=ON_SB_OFF
   *  Values sent as strings per Xenia API: {"action":"1"} */
  async control(action: number): Promise<boolean> { return this.post('/machine/control/', { action: String(action) }); }

  /** Toggle steam boiler on/off */
  async toggleSteamBoiler(on: boolean): Promise<boolean> { return this.post('/toggle_sb', { TOGGLE: String(on) }); }

  /** Set brew group + brew boiler target temperature */
  async setTemperatures(bgTemp: number, bbTemp: number): Promise<boolean> {
    return this.post('/inc_dec', { BG_SET_TEMP: String(bgTemp), BB_SET_TEMP: String(bbTemp) });
  }

  /** Set brew boiler target temperature only */
  async setBrewBoilerTemp(bbTemp: number): Promise<boolean> {
    return this.post('/inc_dec_bb', { BB_SET_TEMP: String(bbTemp) });
  }

  /** Execute a script on the machine */
  async executeScript(scriptId: number): Promise<boolean> { return this.post('/scripts/execute/', { ID: String(scriptId) }); }
}
