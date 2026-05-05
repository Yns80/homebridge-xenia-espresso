import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { XeniaPlatform } from './platform';
import { XeniaApi, MachineStatus, SteamBoilerStatus } from './xeniaApi';
import { XeniaAction } from './settings';

/**
 * XeniaMachineAccessory
 *
 * HomeKit services:
 *   - Switch "Espresso Machine"      → MA_STATUS (0=OFF,1=ON,2=ECO,3=BREWING,4=DRAINING)
 *   - Switch "Steam Boiler"          → SB_STATUS (1=OFF, 2=ON)
 *   - Switch "ECO Mode"              → MA_STATUS=2
 *   - TemperatureSensor "Brew Boiler Temperature"  → BB_SENS_TEMP_A
 *   - TemperatureSensor "Brew Group Temperature"   → BG_SENS_TEMP_A
 *   - Thermostat "Boiler Target Temperature"       → BB_SET_TEMP
 *   - LeakSensor "Water Tank"        → PU_SENS_WATER_TANK_LEVEL
 *   - AirQualitySensor "Steam Boiler Pressure" → SB_SENS_PRESS (bar)
 *   - AirQualitySensor "Pump Pressure"         → PU_SENS_PRESS (bar)
 */
export class XeniaMachineAccessory {
  private mainSwitch: Service;
  private steamSwitch: Service;
  private ecoSwitch: Service;
  private brewBoilerTempSensor: Service;
  private brewGroupTempSensor: Service;
  private thermostat: Service;
  private waterSensor?: Service;
  private _waterTankType: 'filter' | 'contact' | 'leak' | 'none' = 'filter';
  private steamPressureSensor: Service;
  private pumpPressureSensor: Service;
  private infoService: Service;

  private readonly api: XeniaApi;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;

  private state = {
    machineOn: false,
    steamOn: false,
    ecoMode: false,
    brewBoilerTemp: 0,
    brewGroupTemp: 0,
    targetTemp: 93,
    waterEmpty: false,
    steamPressure: 0,
    pumpPressure: 0,
  };

  constructor(
    private readonly platform: XeniaPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    const ip = accessory.context['ip'] as string;
    const pollInterval = (accessory.context['pollInterval'] as number) * 1000;

    this.api = new XeniaApi(ip, platform.log);

    // ── Accessory informatie ──────────────────────────────────────────
    this.infoService =
      this.accessory.getService(this.platform.Service.AccessoryInformation)!
      || this.accessory.addService(this.platform.Service.AccessoryInformation);

    this.infoService
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Xenia Espresso GmbH')
      .setCharacteristic(this.platform.Characteristic.Model, 'Xenia DB / HX')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, ip);

    // ── Switch: Machine power (MA_STATUS on/off) ─────────────────────
    this.mainSwitch =
      this.accessory.getServiceById(this.platform.Service.Switch, 'main-switch') ||
      this.accessory.addService(this.platform.Service.Switch, 'Espresso Machine', 'main-switch');
    this.mainSwitch
      .setCharacteristic(this.platform.Characteristic.Name, 'Espresso Machine')
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Espresso Machine');
    this.mainSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onGet(() => this.state.machineOn)
      .onSet(this.setMachineOn.bind(this));

    // ── Switch: Steam boiler (SB_STATUS on/off) ─────────────────────
    this.steamSwitch =
      this.accessory.getServiceById(this.platform.Service.Switch, 'steam-switch') ||
      this.accessory.addService(this.platform.Service.Switch, 'Steam Boiler', 'steam-switch');
    this.steamSwitch
      .setCharacteristic(this.platform.Characteristic.Name, 'Steam Boiler')
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Steam Boiler');
    this.steamSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onGet(() => this.state.steamOn)
      .onSet(this.setSteamOn.bind(this));

    // ── Switch: ECO mode (MA_STATUS standby) ─────────────────────────
    this.ecoSwitch =
      this.accessory.getServiceById(this.platform.Service.Switch, 'eco-switch') ||
      this.accessory.addService(this.platform.Service.Switch, 'ECO Mode', 'eco-switch');
    this.ecoSwitch
      .setCharacteristic(this.platform.Characteristic.Name, 'ECO Mode')
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'ECO Mode');
    this.ecoSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onGet(() => this.state.ecoMode)
      .onSet(this.setEcoMode.bind(this));

    // ── Temperature Sensor: Brew Boiler (BB_SENS_TEMP_A) ─────────────
    this.brewBoilerTempSensor =
      this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'brew-boiler-temp') ||
      this.accessory.addService(this.platform.Service.TemperatureSensor, 'Brew Boiler Temperature', 'brew-boiler-temp');
    this.brewBoilerTempSensor
      .setCharacteristic(this.platform.Characteristic.Name, 'Brew Boiler Temperature')
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Brew Boiler Temperature');
    this.brewBoilerTempSensor.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(() => this.state.brewBoilerTemp);

    // ── Temperature Sensor: Brew Group (BG_SENS_TEMP_A) ──────────────
    this.brewGroupTempSensor =
      this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'brew-group-temp') ||
      this.accessory.addService(this.platform.Service.TemperatureSensor, 'Brew Group Temperature', 'brew-group-temp');
    this.brewGroupTempSensor
      .setCharacteristic(this.platform.Characteristic.Name, 'Brew Group Temperature')
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Brew Group Temperature');
    this.brewGroupTempSensor.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(() => this.state.brewGroupTemp);

    // ── Thermostat: Boiler target temperature (BB_SET_TEMP) ───────────
    this.thermostat =
      this.accessory.getServiceById(this.platform.Service.Thermostat, 'thermostat') ||
      this.accessory.addService(this.platform.Service.Thermostat, 'Boiler Target Temperature', 'thermostat');
    this.thermostat
      .setCharacteristic(this.platform.Characteristic.Name, 'Boiler Target Temperature')
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Boiler Target Temperature');
    this.thermostat.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(() => this.state.machineOn ? 1 : 0);
    this.thermostat.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .setProps({ validValues: [0, 1] })
      .onGet(() => this.state.machineOn ? 1 : 0)
      .onSet(async (value) => { await this.setMachineOn(value === 1); });
    this.thermostat.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(() => this.state.brewBoilerTemp);
    this.thermostat.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps({ minValue: 70, maxValue: 105, minStep: 0.5 })
      .onGet(() => this.state.targetTemp)
      .onSet(this.setTargetTemperature.bind(this));
    this.thermostat.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onGet(() => 0);

    // ── Water Tank Sensor (configurable type) ────────────────────────
    // Default to FilterMaintenance to avoid HomeKit's emergency-style
    // "Leak detected!" notifications when the tank is just low.
    const waterTankType =
      (this.platform.config['waterTankSensor'] as 'filter' | 'contact' | 'leak' | 'none') || 'filter';
    this._waterTankType = waterTankType;

    const allWaterSubtypes = ['water-filter', 'water-contact', 'water-sensor'];
    const waterServiceMap: Record<'filter' | 'contact' | 'leak', { ServiceCtor: any; subtype: string }> = {
      filter:  { ServiceCtor: this.platform.Service.FilterMaintenance, subtype: 'water-filter' },
      contact: { ServiceCtor: this.platform.Service.ContactSensor, subtype: 'water-contact' },
      leak:    { ServiceCtor: this.platform.Service.LeakSensor, subtype: 'water-sensor' },
    };

    // Remove any stale water-tank services from the cached accessory that don't match the active config
    const expectedSubtype = waterTankType === 'none' ? null : waterServiceMap[waterTankType].subtype;
    for (const service of [...this.accessory.services]) {
      if (service.subtype && allWaterSubtypes.includes(service.subtype) && service.subtype !== expectedSubtype) {
        this.platform.log.info(`Removing stale water sensor service: ${service.subtype}`);
        this.accessory.removeService(service);
      }
    }

    if (waterTankType !== 'none') {
      const { ServiceCtor, subtype } = waterServiceMap[waterTankType];
      this.waterSensor =
        this.accessory.getServiceById(ServiceCtor, subtype) ||
        this.accessory.addService(ServiceCtor, 'Water Tank', subtype);
      this.waterSensor
        .setCharacteristic(this.platform.Characteristic.Name, 'Water Tank')
        .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Water Tank');
      const watchedChar =
        waterTankType === 'filter'  ? this.platform.Characteristic.FilterChangeIndication :
        waterTankType === 'contact' ? this.platform.Characteristic.ContactSensorState :
                                      this.platform.Characteristic.LeakDetected;
      this.waterSensor.getCharacteristic(watchedChar)
        .onGet(() => this.state.waterEmpty ? 1 : 0);
    }

    // ── Steam Boiler Pressure (SB_SENS_PRESS) ────────────────────────
    // HomeKit has no native pressure service — we use AirQualitySensor
    // as a numeric display tile. Eve app shows the raw value in bar.
    this.steamPressureSensor =
      this.accessory.getServiceById(this.platform.Service.AirQualitySensor, 'steam-pressure') ||
      this.accessory.addService(this.platform.Service.AirQualitySensor, 'Steam Boiler Pressure', 'steam-pressure');
    this.steamPressureSensor
      .setCharacteristic(this.platform.Characteristic.Name, 'Steam Boiler Pressure')
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Steam Boiler Pressure');
    this.steamPressureSensor.getCharacteristic(this.platform.Characteristic.AirQuality)
      .onGet(() => 1); // 1 = EXCELLENT, keeps the tile green

    // ── Pump Pressure (PU_SENS_PRESS) ────────────────────────────────
    this.pumpPressureSensor =
      this.accessory.getServiceById(this.platform.Service.AirQualitySensor, 'pump-pressure') ||
      this.accessory.addService(this.platform.Service.AirQualitySensor, 'Pump Pressure', 'pump-pressure');
    this.pumpPressureSensor
      .setCharacteristic(this.platform.Characteristic.Name, 'Pump Pressure')
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Pump Pressure');
    this.pumpPressureSensor.getCharacteristic(this.platform.Characteristic.AirQuality)
      .onGet(() => 1);

    // ── Start polling ─────────────────────────────────────────────────
    this.pollStatus();
    this._pollTimer = setInterval(() => this.pollStatus(), pollInterval);

    this.platform.log.info(`Xenia accessory klaar — IP: ${ip}, polling elke ${pollInterval / 1000}s`);
  }

  // ──────────────────────────────────────────────────────────────────
  // STATUS POLLING
  // ──────────────────────────────────────────────────────────────────

  private async pollStatus() {
    const [overview, single] = await Promise.all([
      this.api.getOverview(),
      this.api.getOverviewSingle(),
    ]);

    if (overview) {
      // MA_STATUS: 0=OFF, 1=ON, 2=ECO, 3=BREWING, 4=DRAINING
      // Machine counts as "on" while brewing or draining too
      const machineOn = overview.MA_STATUS === MachineStatus.ON
        || overview.MA_STATUS === MachineStatus.BREWING
        || overview.MA_STATUS === MachineStatus.DRAINING;
      const ecoMode   = overview.MA_STATUS === MachineStatus.ECO;
      const brewing   = overview.MA_STATUS === MachineStatus.BREWING;

      // SB_STATUS: 1=OFF, 2=ON (not 0/1 — this was a bug)
      const steamOn = overview.SB_STATUS === SteamBoilerStatus.ON;

      const brewBoilerTemp = Math.round(overview.BB_SENS_TEMP_A * 10) / 10;
      const brewGroupTemp  = Math.round(overview.BG_SENS_TEMP_A * 10) / 10;
      const steamPressure  = Math.round(overview.SB_SENS_PRESS * 100) / 100;
      const pumpPressure   = Math.round(overview.PU_SENS_PRESS * 100) / 100;
      // MA_OPERATING_HOURS is in minutes
      const opHours = Math.round(overview.MA_OPERATING_HOURS / 60);

      if (this.state.machineOn !== machineOn) {
        this.state.machineOn = machineOn;
        this.mainSwitch.updateCharacteristic(this.platform.Characteristic.On, machineOn);
        this.thermostat.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, machineOn ? 1 : 0);
        this.thermostat.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, machineOn ? 1 : 0);
      }
      if (this.state.ecoMode !== ecoMode) {
        this.state.ecoMode = ecoMode;
        this.ecoSwitch.updateCharacteristic(this.platform.Characteristic.On, ecoMode);
      }
      if (this.state.steamOn !== steamOn) {
        this.state.steamOn = steamOn;
        this.steamSwitch.updateCharacteristic(this.platform.Characteristic.On, steamOn);
      }
      if (this.state.brewBoilerTemp !== brewBoilerTemp) {
        this.state.brewBoilerTemp = brewBoilerTemp;
        this.brewBoilerTempSensor.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, brewBoilerTemp);
        this.thermostat.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, brewBoilerTemp);
      }
      if (this.state.brewGroupTemp !== brewGroupTemp) {
        this.state.brewGroupTemp = brewGroupTemp;
        this.brewGroupTempSensor.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, brewGroupTemp);
      }
      if (this.state.steamPressure !== steamPressure) {
        this.state.steamPressure = steamPressure;
      }
      if (this.state.pumpPressure !== pumpPressure) {
        this.state.pumpPressure = pumpPressure;
      }

      const statusLabel = brewing ? 'BREWING' : overview.MA_STATUS === MachineStatus.DRAINING ? 'DRAINING' : machineOn ? 'ON' : ecoMode ? 'ECO' : 'OFF';
      this.platform.log.info(
        `[Xenia] ${statusLabel} | ` +
        `boiler: ${brewBoilerTemp}°C | group: ${brewGroupTemp}°C | ` +
        `steam: ${steamPressure} bar | pump: ${pumpPressure} bar | ` +
        `shots: ${overview.MA_EXTRACTIONS} | last: ${overview.MA_LAST_EXTRACTION_ML} ml | ` +
        `flow: ${overview.PU_SENS_FLOW_METER_ML} ml | scale: ${overview.SCALE_WEIGHT} g | ` +
        `power: ${overview.MA_CUR_PWR} W | ${opHours} hrs`,
      );

      // Accessory Information tile (Home app ⓘ details)
      this.infoService
        .setCharacteristic(
          this.platform.Characteristic.FirmwareRevision,
          `${overview.MA_EXTRACTIONS} shots | ${opHours} hrs`,
        )
        .setCharacteristic(
          this.platform.Characteristic.HardwareRevision,
          `Last: ${overview.MA_LAST_EXTRACTION_ML} ml | ${overview.MA_CUR_PWR} W`,
        );
    }

    if (single) {
      const waterEmpty = single.PU_SENS_WATER_TANK_LEVEL === 0;
      const targetTemp = single.BB_SET_TEMP;

      if (this.state.waterEmpty !== waterEmpty) {
        this.state.waterEmpty = waterEmpty;
        if (this.waterSensor && this._waterTankType !== 'none') {
          const watchedChar =
            this._waterTankType === 'filter'  ? this.platform.Characteristic.FilterChangeIndication :
            this._waterTankType === 'contact' ? this.platform.Characteristic.ContactSensorState :
                                                this.platform.Characteristic.LeakDetected;
          this.waterSensor.updateCharacteristic(watchedChar, waterEmpty ? 1 : 0);
        }
        if (waterEmpty) {
          this.platform.log.warn('[Xenia] ⚠️  Waterreservoir is leeg!');
        }
      }
      if (targetTemp > 0 && this.state.targetTemp !== targetTemp) {
        this.state.targetTemp = targetTemp;
        this.thermostat.updateCharacteristic(this.platform.Characteristic.TargetTemperature, targetTemp);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // MACHINE AAN/UIT
  // ──────────────────────────────────────────────────────────────────

  private async setMachineOn(value: CharacteristicValue) {
    const on = value as boolean;
    this.platform.log.info(`Machine ${on ? 'aanzetten' : 'uitzetten'}...`);
    const success = await this.api.control(on ? XeniaAction.PowerOn : XeniaAction.PowerOff);
    if (success) {
      this.state.machineOn = on;
      if (on) {
        this.state.ecoMode = false;
        this.ecoSwitch.updateCharacteristic(this.platform.Characteristic.On, false);
      }
      this.thermostat.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, on ? 1 : 0);
    } else {
      setInterval(() => this.mainSwitch.updateCharacteristic(this.platform.Characteristic.On, !on), 500);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // STOOMBOILER
  // ──────────────────────────────────────────────────────────────────

  private async setSteamOn(value: CharacteristicValue) {
    const on = value as boolean;
    this.platform.log.info(`Stoomboiler ${on ? 'aanzetten' : 'uitzetten'}...`);
    const success = await this.api.toggleSteamBoiler(on);
    if (!success) {
      setInterval(() => this.steamSwitch.updateCharacteristic(this.platform.Characteristic.On, !on), 500);
    } else {
      this.state.steamOn = on;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // ECO MODUS
  // ──────────────────────────────────────────────────────────────────

  private async setEcoMode(value: CharacteristicValue) {
    const on = value as boolean;
    this.platform.log.info(`ECO modus ${on ? 'inschakelen' : 'uitschakelen'}...`);
    if (on) {
      const success = await this.api.control(XeniaAction.EcoMode);
      if (success) {
        this.state.ecoMode = true;
        this.state.machineOn = false;
        this.mainSwitch.updateCharacteristic(this.platform.Characteristic.On, false);
      } else {
        setInterval(() => this.ecoSwitch.updateCharacteristic(this.platform.Characteristic.On, false), 500);
      }
    } else {
      const success = await this.api.control(XeniaAction.PowerOn);
      if (success) {
        this.state.ecoMode = false;
        this.state.machineOn = true;
        this.mainSwitch.updateCharacteristic(this.platform.Characteristic.On, true);
      } else {
        setInterval(() => this.ecoSwitch.updateCharacteristic(this.platform.Characteristic.On, true), 500);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // DOELTEMPERATUUR
  // ──────────────────────────────────────────────────────────────────

  private async setTargetTemperature(value: CharacteristicValue) {
    const temp = value as number;
    this.platform.log.info(`Boiler doeltemperatuur instellen op ${temp}°C...`);
    const success = await this.api.setTemperatures(temp, temp);
    if (success) {
      this.state.targetTemp = temp;
      this.platform.log.info(`Boiler doeltemperatuur ingesteld op ${temp}°C`);
    }
  }
}
