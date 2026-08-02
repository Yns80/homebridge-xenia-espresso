import * as http from 'http';
import { Logger } from 'homebridge';

export interface XeniaStatus {
  MA_STATUS: number; // 0=uit, 1=aan, 2=eco
}

export interface XeniaOverview {
  MA_EXTRACTIONS: number;
  MA_OPERATING_HOURS: number;
  MA_STATUS: number;
  MA_CLOCK: number;
  MA_CUR_PWR: number;
  MA_MAX_PWR: number;
  MA_ENERGY_TOTAL_KWH: number;
  BG_SENS_TEMP_A: number;
  BG_LEVEL_PW_CONTROL: number;
  PU_SENS_PRESS: number;
  PU_LEVEL_PW_CONTROL: number;
  PU_SET_LEVEL_PW_CONTROL: number;
  SB_SENS_PRESS: number;
  BB_SENS_TEMP_A: number;
  BB_LEVEL_PW_CONTROL: number;
  SB_STATUS: number;
  MA_LAST_EXTRACTION_ML: string;
}

export interface XeniaOverviewSingle {
  BG_SET_TEMP: number;
  PU_SET_PRESS: number;
  PU_SENS_WATER_TANK_LEVEL: number;
  SB_SET_PRESS: number;
  BB_SET_TEMP: number;
  PSP: number;
  MA_MAC: string;
  MA_EXTRACTIONS_START: number;
  POP_UP?: number;
}

export interface XeniaMachineInfo {
  MA_TYPE: number;
  MA_FIX_WATER_SUPPLY: number;
  MA_HEATUP_FLUSH_EN: number;
  MA_SET_TIMER_ECO_MA: number;
  MA_SET_TIMER_POWERDOWN: number;
  MA_MAX_AMPERE: number;
  MA_ENERGY_TOTAL_KWH: number;
  FW_VERSION_MAJOR: number;
  FW_VERSION_MINOR: number;
  ESP_FW_MAJOR: number;
  ESP_FW_MINOR: number;
  MA_SN: string;
}

export interface XeniaDiagram {
  BG_LEVEL_PW_CONTROL: number;
  BB_LEVEL_PW_CONTROL: number;
  BG_SENS_TEMP_A: number;
  BB_SENS_TEMP_A: number;
  PU_SENS_FLOW_METER_ML: number;
  PU_SENS_PRESS: number;
}

/**
 * HTTP client voor de Xenia ESP32 API v2.
 * Quirk: POST requests verwachten JSON body maar met
 * Content-Type: application/x-www-form-urlencoded header.
 * ECONNRESET na POST = succes (ESP32 sluit socket na response).
 */
export class XeniaApi {
  constructor(private readonly ip: string, private readonly log: Logger) {}

  private httpGet(path: string): Promise<unknown> {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: this.ip, port: 80,
          path: '/api/v2' + path, method: 'GET',
          agent: false,
          headers: { 'Connection': 'close' },
        },
        (res) => {
          let raw = '';
          res.on('data', (c: Buffer) => { raw += c.toString(); });
          res.on('end', () => {
            try { resolve(JSON.parse(raw)); } catch { resolve(null); }
          });
        });
      req.on('error', () => resolve(null));
      req.setTimeout(6000, () => { req.destroy(); resolve(null); });
      req.end();
    });
  }

  private httpPost(path: string, body: object): Promise<boolean> {
    return new Promise((resolve) => {
      // JSON body + form-urlencoded Content-Type = de Xenia API quirk
      const data = JSON.stringify(body);
      const req = http.request(
        {
          hostname: this.ip, port: 80,
          path: '/api/v2' + path, method: 'POST',
          agent: false,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(data),
            'Connection': 'close',
          },
        },
        (res) => {
          this.log.debug(`[XeniaAPI] POST ${path} -> ${res.statusCode}`);
          res.resume();
          res.on('end', () => resolve(true));
        });
      req.on('error', (e: NodeJS.ErrnoException) => {
        // ECONNRESET = ESP32 sluit socket na response = succes
        if (e.code === 'ECONNRESET' || e.code === 'EPIPE') {
          resolve(true);
        } else {
          this.log.warn(`[XeniaAPI] POST ${path} error: ${e.message}`);
          resolve(false);
        }
      });
      req.setTimeout(6000, () => { req.destroy(); resolve(false); });
      req.write(data);
      req.end();
    });
  }

  // ── GET endpoints ──────────────────────────────────────────────────

  async getStatus(): Promise<XeniaStatus | null> {
    return this.httpGet('/status') as Promise<XeniaStatus | null>;
  }

  async getOverview(): Promise<XeniaOverview | null> {
    return this.httpGet('/overview') as Promise<XeniaOverview | null>;
  }

  async getOverviewSingle(): Promise<XeniaOverviewSingle | null> {
    return this.httpGet('/overview_single') as Promise<XeniaOverviewSingle | null>;
  }

  async getMachineInfo(): Promise<XeniaMachineInfo | null> {
    return this.httpGet('/machine') as Promise<XeniaMachineInfo | null>;
  }

  async getDiagram(): Promise<XeniaDiagram | null> {
    return this.httpGet('/diagram_get') as Promise<XeniaDiagram | null>;
  }

  // ── POST endpoints ─────────────────────────────────────────────────

  /** Machine aan/uit/eco: 0=uit, 1=aan, 2=eco, 3=stoom uit, 4=stoom aan, 5=aan+stoom uit */
  async control(action: number): Promise<boolean> {
    return this.httpPost('/machine/control', { action: String(action) });
  }

  /** Stoomboiler aan/uit */
  async toggleSteamBoiler(on: boolean): Promise<boolean> {
    return this.httpPost('/toggle_sb', { TOGGLE: on });
  }

  /** Koffieboiler temperatuur aanpassen (+0.1 of -0.1) */
  async incDecBrewBoiler(delta: number): Promise<boolean> {
    return this.httpPost('/inc_dec_bb', { BB_SET_TEMP: delta });
  }

  /** Stoomboiler druk aanpassen (+0.1 of -0.1) */
  async incDecSteamBoiler(delta: number): Promise<boolean> {
    return this.httpPost('/inc_dec_sb', { SB_SET_PRESS: delta });
  }

  /** Brewgroup + koffieboiler doeltemperatuur direct instellen */
  async setTemperatures(bgTemp: number, bbTemp: number): Promise<boolean> {
    return this.httpPost('/inc_dec', { BG_SET_TEMP: bgTemp, BB_SET_TEMP: bbTemp });
  }

  /** Machine instellingen aanpassen */
  async setMachineSettings(settings: {
    MA_SET_TIMER_ECO_MA?: number;
    MA_SET_TIMER_POWERDOWN?: number;
    MA_FIX_WATER_SUPPLY?: number;
    MA_MAX_AMPERE?: number;
    MA_HEATUP_FLUSH_EN?: number;
  }): Promise<boolean> {
    return this.httpPost('/machine', settings);
  }

  /** Script uitvoeren */
  async executeScript(scriptId: number): Promise<boolean> {
    return this.httpPost('/scripts/execute/', { ID: String(scriptId) });
  }
}
