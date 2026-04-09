import { Logger } from 'homebridge';

export interface XeniaStatus {
  status: number;       // 0 = uit, 1 = aan, 2 = eco
  temp_boiler?: number; // temperatuur koffieboiler (°C)
  temp_steam?: number;  // temperatuur stoomboiler (°C)
  [key: string]: unknown;
}

/**
 * Lichtgewicht HTTP client voor de Xenia ESP32 API v2.
 * Alle communicatie gaat via lokaal netwerk (geen cloud).
 */
export class XeniaApi {
  private readonly baseUrl: string;

  constructor(ip: string, private readonly log: Logger) {
    this.baseUrl = `http://${ip}/api/v2`;
  }

  /**
   * Haal de huidige machinestatus op.
   */
  async getStatus(): Promise<XeniaStatus | null> {
    try {
      const res = await fetch(`${this.baseUrl}/machine/status/`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        this.log.warn(`[XeniaAPI] Status ophalen mislukt: HTTP ${res.status}`);
        return null;
      }
      return await res.json() as XeniaStatus;
    } catch (err) {
      this.log.error('[XeniaAPI] Verbindingsfout bij status ophalen:', err);
      return null;
    }
  }

  /**
   * Stuur een machinecommando.
   * @param action - XeniaAction enum waarde (0-5)
   */
  async control(action: number): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/machine/control/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        this.log.warn(`[XeniaAPI] Control mislukt: HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (err) {
      this.log.error('[XeniaAPI] Verbindingsfout bij control:', err);
      return false;
    }
  }

  /**
   * Voer een script uit op de machine.
   * @param scriptId - het ID van het script (zie Homebridge config of machine display)
   */
  async executeScript(scriptId: number): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/scripts/execute/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ID: String(scriptId) }),
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch (err) {
      this.log.error('[XeniaAPI] Fout bij script uitvoeren:', err);
      return false;
    }
  }

  /**
   * Stop een actief script op de machine.
   */
  async stopScript(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/scripts/stop`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch (err) {
      this.log.error('[XeniaAPI] Fout bij script stoppen:', err);
      return false;
    }
  }
}
