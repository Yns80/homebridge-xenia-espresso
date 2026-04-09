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

export class XeniaApi {
  constructor(private readonly ip: string, private readonly log: Logger) {}

  private request(method: string, path: string, body?: object): Promise<unknown> {
    return new Promise((resolve) => {
      const data = body ? JSON.stringify(body) : undefined;
      // POST: Xenia requires JSON body with application/x-www-form-urlencoded Content-Type
      // GET: standard application/json
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

  /** Full overview: temperatures, pressure, status */
  async getOverview(): Promise<XeniaOverview | null> { return this.get<XeniaOverview>('/overview'); }

  /** Settings: target temperatures, water tank level */
  async getOverviewSingle(): Promise<XeniaOverviewSingle | null> { return this.get<XeniaOverviewSingle>('/overview_single'); }

  /** Machine control: 0=off, 1=on, 2=eco, 3=steam off, 4=steam on, 5=on+steam off
   *  Xenia expects action as a string per Pascal API example: {"action":"1"} */
  async control(action: number): Promise<boolean> { return this.post('/machine/control/', { action: String(action) }); }

  /** Toggle steam boiler on/off */
  async toggleSteamBoiler(on: boolean): Promise<boolean> { return this.post('/toggle_sb', { TOGGLE: String(on) }); }

  /** Set brew group + brew boiler target temperature */
  async setTemperatures(bgTemp: number, bbTemp: number): Promise<boolean> {
    return this.post('/inc_dec', { BG_SET_TEMP: String(bgTemp), BB_SET_TEMP: String(bbTemp) });
  }

  /** Execute a script on the machine */
  async executeScript(scriptId: number): Promise<boolean> { return this.post('/scripts/execute/', { ID: String(scriptId) }); }
}
