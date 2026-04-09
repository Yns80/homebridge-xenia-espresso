import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { XeniaPlatform } from './platform';
import { XeniaApi } from './xeniaApi';
import { XeniaAction } from './settings';

/**
 * XeniaMachineAccessory
 *
 * Stelt de Xenia espressomachine voor als HomeKit accessory met:
 *   - Switch "Koffiemachine"   → machine aan/uit
 *   - Switch "Stoomboiler"     → stoomboiler aan/uit
 *   - Switch "ECO modus"       → eco modus aan/uit
 */
export class XeniaMachineAccessory {
  private mainSwitch: Service;
  private steamSwitch: Service;
  private ecoSwitch: Service;
  private infoService: Service;

  private readonly api: XeniaApi;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  // Lokale state cache
  private state = {
    machineOn: false,
    steamOn: false,
    ecoMode: false,
  };

  constructor(
    private readonly platform: XeniaPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    const ip = accessory.context['ip'] as string;
    const pollInterval = (accessory.context['pollInterval'] as number) * 1000;

    this.api = new XeniaApi(ip, platform.log);

    // --- Accessory informatie ---
    this.infoService =
      this.accessory.getService(this.platform.Service.AccessoryInformation)!
        || this.accessory.addService(this.platform.Service.AccessoryInformation);

    this.infoService
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Xenia Espresso GmbH')
      .setCharacteristic(this.platform.Characteristic.Model, 'Xenia DB / HX')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, ip);

    // --- Hoofdschakelaar: Machine aan/uit ---
    this.mainSwitch =
      this.accessory.getService('Koffiemachine') ||
      this.accessory.addService(this.platform.Service.Switch, 'Koffiemachine', 'main-switch');

    this.mainSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Koffiemachine');

    this.mainSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getMachineOn.bind(this))
      .onSet(this.setMachineOn.bind(this));

    // --- Stoomboiler schakelaar ---
    this.steamSwitch =
      this.accessory.getService('Stoomboiler') ||
      this.accessory.addService(this.platform.Service.Switch, 'Stoomboiler', 'steam-switch');

    this.steamSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Stoomboiler');

    this.steamSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getSteamOn.bind(this))
      .onSet(this.setSteamOn.bind(this));

    // --- ECO modus schakelaar ---
    this.ecoSwitch =
      this.accessory.getService('ECO Modus') ||
      this.accessory.addService(this.platform.Service.Switch, 'ECO Modus', 'eco-switch');

    this.ecoSwitch.setCharacteristic(this.platform.Characteristic.Name, 'ECO Modus');

    this.ecoSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getEcoMode.bind(this))
      .onSet(this.setEcoMode.bind(this));

    // --- Start status polling ---
    this.pollStatus();
    this.pollTimer = setInterval(() => this.pollStatus(), pollInterval);

    this.platform.log.info(`Xenia accessory klaar — IP: ${ip}, polling elke ${pollInterval / 1000}s`);
  }

  // ──────────────────────────────────────────────
  // STATUS POLLING
  // ──────────────────────────────────────────────

  private async pollStatus() {
    const status = await this.api.getStatus();
    if (!status) {
      return;
    }

    // status: 0 = uit, 1 = aan, 2 = eco
    const wasOn = this.state.machineOn;
    const wasEco = this.state.ecoMode;
    const wasSteam = this.state.steamOn;

    this.state.machineOn = status.status === 1;
    this.state.ecoMode = status.status === 2;

    // Stoomboiler status — pas aan op basis van API response
    // Xenia retourneert mogelijk een 'steam' veld; anders afleiden uit status
    if (typeof status['steam'] === 'number') {
      this.state.steamOn = status['steam'] === 1;
    }

    // Update HomeKit alleen als de state veranderd is
    if (wasOn !== this.state.machineOn) {
      this.mainSwitch.updateCharacteristic(this.platform.Characteristic.On, this.state.machineOn);
    }
    if (wasEco !== this.state.ecoMode) {
      this.ecoSwitch.updateCharacteristic(this.platform.Characteristic.On, this.state.ecoMode);
    }
    if (wasSteam !== this.state.steamOn) {
      this.steamSwitch.updateCharacteristic(this.platform.Characteristic.On, this.state.steamOn);
    }
  }

  // ──────────────────────────────────────────────
  // HOOFDSCHAKELAAR (machine aan/uit)
  // ──────────────────────────────────────────────

  async getMachineOn(): Promise<CharacteristicValue> {
    return this.state.machineOn;
  }

  async setMachineOn(value: CharacteristicValue) {
    const on = value as boolean;
    this.platform.log.info(`Machine ${on ? 'aanzetten' : 'uitzetten'}...`);

    const action = on ? XeniaAction.PowerOn : XeniaAction.PowerOff;
    const success = await this.api.control(action);

    if (success) {
      this.state.machineOn = on;
      if (on) {
        this.state.ecoMode = false;
        this.ecoSwitch.updateCharacteristic(this.platform.Characteristic.On, false);
      }
    } else {
      // Terugdraaien in HomeKit als commando mislukt
      setTimeout(() => {
        this.mainSwitch.updateCharacteristic(this.platform.Characteristic.On, !on);
      }, 500);
    }
  }

  // ──────────────────────────────────────────────
  // STOOMBOILER
  // ──────────────────────────────────────────────

  async getSteamOn(): Promise<CharacteristicValue> {
    return this.state.steamOn;
  }

  async setSteamOn(value: CharacteristicValue) {
    const on = value as boolean;
    this.platform.log.info(`Stoomboiler ${on ? 'aanzetten' : 'uitzetten'}...`);

    const action = on ? XeniaAction.SteamBoilerOn : XeniaAction.SteamBoilerOff;
    const success = await this.api.control(action);

    if (success) {
      this.state.steamOn = on;
    } else {
      setTimeout(() => {
        this.steamSwitch.updateCharacteristic(this.platform.Characteristic.On, !on);
      }, 500);
    }
  }

  // ──────────────────────────────────────────────
  // ECO MODUS
  // ──────────────────────────────────────────────

  async getEcoMode(): Promise<CharacteristicValue> {
    return this.state.ecoMode;
  }

  async setEcoMode(value: CharacteristicValue) {
    const on = value as boolean;
    this.platform.log.info(`ECO modus ${on ? 'inschakelen' : 'uitschakelen'}...`);

    if (on) {
      const success = await this.api.control(XeniaAction.EcoMode);
      if (success) {
        this.state.ecoMode = true;
        this.state.machineOn = false;
        this.mainSwitch.updateCharacteristic(this.platform.Characteristic.On, false);
      } else {
        setTimeout(() => {
          this.ecoSwitch.updateCharacteristic(this.platform.Characteristic.On, false);
        }, 500);
      }
    } else {
      // Uit ECO: machine normaal aanzetten
      const success = await this.api.control(XeniaAction.PowerOn);
      if (success) {
        this.state.ecoMode = false;
        this.state.machineOn = true;
        this.mainSwitch.updateCharacteristic(this.platform.Characteristic.On, true);
      } else {
        setTimeout(() => {
          this.ecoSwitch.updateCharacteristic(this.platform.Characteristic.On, true);
        }, 500);
      }
    }
  }
}
