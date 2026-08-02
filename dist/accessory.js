"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XeniaMachineAccessory = void 0;
const xeniaApi_1 = require("./xeniaApi");
/**
 * XeniaMachineAccessory — volledige HomeKit implementatie
 *
 * Services:
 *   - Switch         "Koffiemachine"     → aan/uit
 *   - Switch         "Stoomboiler"       → stoomboiler aan/uit
 *   - Switch         "ECO Modus"         → eco modus
 *   - TempSensor     "Koffieboiler"      → actuele boilertemperatuur
 *   - TempSensor     "Brewgroup"         → actuele brewgroup temperatuur
 *   - Thermostat     "Boiler Instelling" → doeltemperatuur instellen
 *   - LeakSensor     "Waterreservoir"    → leeg-melding
 *   - AccessoryInfo                      → firmware versie, serienummer
 */
class XeniaMachineAccessory {
    platform;
    accessory;
    mainSwitch;
    steamSwitch;
    ecoSwitch;
    brewBoilerTempSensor;
    brewGroupTempSensor;
    thermostat;
    waterSensor;
    infoService;
    api;
    pollTimer = null;
    state = {
        machineOn: false,
        steamOn: false,
        ecoMode: false,
        brewBoilerTemp: 0,
        brewGroupTemp: 0,
        targetTemp: 93,
        waterEmpty: false,
        firmwareVersion: '0.0',
        serialNumber: 'unknown',
    };
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        const ip = accessory.context['ip'];
        const pollInterval = accessory.context['pollInterval'] * 1000;
        this.api = new xeniaApi_1.XeniaApi(ip, platform.log);
        // ── Accessory informatie (firmware versie erbij) ────────────────
        this.infoService =
            this.accessory.getService(this.platform.Service.AccessoryInformation)
                || this.accessory.addService(this.platform.Service.AccessoryInformation);
        this.infoService
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Xenia Espresso GmbH')
            .setCharacteristic(this.platform.Characteristic.Model, 'Xenia DB / HX')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, ip)
            .setCharacteristic(this.platform.Characteristic.FirmwareRevision, '0.0');
        // ── Switch: Machine aan/uit ─────────────────────────────────────
        this.mainSwitch =
            this.accessory.getService('Koffiemachine') ||
                this.accessory.addService(this.platform.Service.Switch, 'Koffiemachine', 'main-switch');
        this.mainSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Koffiemachine');
        this.mainSwitch.getCharacteristic(this.platform.Characteristic.On)
            .onGet(() => this.state.machineOn)
            .onSet(this.setMachineOn.bind(this));
        // ── Switch: Stoomboiler ─────────────────────────────────────────
        this.steamSwitch =
            this.accessory.getService('Stoomboiler') ||
                this.accessory.addService(this.platform.Service.Switch, 'Stoomboiler', 'steam-switch');
        this.steamSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Stoomboiler');
        this.steamSwitch.getCharacteristic(this.platform.Characteristic.On)
            .onGet(() => this.state.steamOn)
            .onSet(this.setSteamOn.bind(this));
        // ── Switch: ECO modus ───────────────────────────────────────────
        this.ecoSwitch =
            this.accessory.getService('ECO Modus') ||
                this.accessory.addService(this.platform.Service.Switch, 'ECO Modus', 'eco-switch');
        this.ecoSwitch.setCharacteristic(this.platform.Characteristic.Name, 'ECO Modus');
        this.ecoSwitch.getCharacteristic(this.platform.Characteristic.On)
            .onGet(() => this.state.ecoMode)
            .onSet(this.setEcoMode.bind(this));
        // ── Temperatuursensor: Koffieboiler ─────────────────────────────
        this.brewBoilerTempSensor =
            this.accessory.getService('Koffieboiler Temp') ||
                this.accessory.addService(this.platform.Service.TemperatureSensor, 'Koffieboiler Temp', 'brew-boiler-temp');
        this.brewBoilerTempSensor.setCharacteristic(this.platform.Characteristic.Name, 'Koffieboiler Temp');
        this.brewBoilerTempSensor.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .setProps({ minValue: 0, maxValue: 120, minStep: 0.1 })
            .onGet(() => this.state.brewBoilerTemp);
        // ── Temperatuursensor: Brewgroup ────────────────────────────────
        this.brewGroupTempSensor =
            this.accessory.getService('Brewgroup Temp') ||
                this.accessory.addService(this.platform.Service.TemperatureSensor, 'Brewgroup Temp', 'brew-group-temp');
        this.brewGroupTempSensor.setCharacteristic(this.platform.Characteristic.Name, 'Brewgroup Temp');
        this.brewGroupTempSensor.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .setProps({ minValue: 0, maxValue: 120, minStep: 0.1 })
            .onGet(() => this.state.brewGroupTemp);
        // ── Thermostat: Boiler doeltemperatuur ─────────────────────────
        this.thermostat =
            this.accessory.getService('Boiler Instelling') ||
                this.accessory.addService(this.platform.Service.Thermostat, 'Boiler Instelling', 'thermostat');
        this.thermostat.setCharacteristic(this.platform.Characteristic.Name, 'Boiler Instelling');
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
        // ── Leak Sensor: Waterreservoir ─────────────────────────────────
        this.waterSensor =
            this.accessory.getService('Waterreservoir') ||
                this.accessory.addService(this.platform.Service.LeakSensor, 'Waterreservoir', 'water-sensor');
        this.waterSensor.setCharacteristic(this.platform.Characteristic.Name, 'Waterreservoir');
        this.waterSensor.getCharacteristic(this.platform.Characteristic.LeakDetected)
            .onGet(() => this.state.waterEmpty ? 1 : 0);
        // ── Haal firmware versie op bij startup ─────────────────────────
        this.fetchMachineInfo();
        // ── Start polling ───────────────────────────────────────────────
        this.pollStatus();
        this.pollTimer = setInterval(() => this.pollStatus(), pollInterval);
        platform.log.info(`Xenia accessory klaar — IP: ${ip}, polling elke ${pollInterval / 1000}s`);
    }
    // ──────────────────────────────────────────────────────────────────
    // MACHINE INFO (firmware versie, serienummer)
    // ──────────────────────────────────────────────────────────────────
    async fetchMachineInfo() {
        const info = await this.api.getMachineInfo();
        if (!info) {
            return;
        }
        const fwVersion = `${info.FW_VERSION_MAJOR}.${info.FW_VERSION_MINOR} (ESP ${info.ESP_FW_MAJOR}.${info.ESP_FW_MINOR})`;
        const serial = info.MA_SN && info.MA_SN !== 'none' ? info.MA_SN : this.accessory.context['ip'];
        this.infoService
            .updateCharacteristic(this.platform.Characteristic.FirmwareRevision, fwVersion)
            .updateCharacteristic(this.platform.Characteristic.SerialNumber, serial);
        this.platform.log.info(`[Xenia] Firmware: ${fwVersion} | SN: ${serial}`);
    }
    // ──────────────────────────────────────────────────────────────────
    // STATUS POLLING
    // ──────────────────────────────────────────────────────────────────
    async pollStatus() {
        const [overview, single] = await Promise.all([
            this.api.getOverview(),
            this.api.getOverviewSingle(),
        ]);
        if (overview) {
            const machineOn = overview.MA_STATUS === 1;
            const ecoMode = overview.MA_STATUS === 2;
            const steamOn = overview.SB_STATUS === 1;
            const brewBoilerTemp = Math.round(overview.BB_SENS_TEMP_A * 10) / 10;
            const brewGroupTemp = Math.round(overview.BG_SENS_TEMP_A * 10) / 10;
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
        }
        if (single) {
            const waterEmpty = single.PU_SENS_WATER_TANK_LEVEL === 0;
            const targetTemp = single.BB_SET_TEMP;
            if (this.state.waterEmpty !== waterEmpty) {
                this.state.waterEmpty = waterEmpty;
                this.waterSensor.updateCharacteristic(this.platform.Characteristic.LeakDetected, waterEmpty ? 1 : 0);
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
    async setMachineOn(value) {
        const on = value;
        this.platform.log.info(`Machine ${on ? 'aanzetten' : 'uitzetten'}...`);
        const success = await this.api.control(on ? 1 /* XeniaAction.PowerOn */ : 0 /* XeniaAction.PowerOff */);
        if (success) {
            this.state.machineOn = on;
            if (on) {
                this.state.ecoMode = false;
                this.ecoSwitch.updateCharacteristic(this.platform.Characteristic.On, false);
            }
            this.thermostat.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, on ? 1 : 0);
        }
        else {
            setInterval(() => this.mainSwitch.updateCharacteristic(this.platform.Characteristic.On, !on), 500);
        }
    }
    // ──────────────────────────────────────────────────────────────────
    // STOOMBOILER
    // ──────────────────────────────────────────────────────────────────
    async setSteamOn(value) {
        const on = value;
        this.platform.log.info(`Stoomboiler ${on ? 'aanzetten' : 'uitzetten'}...`);
        const success = await this.api.toggleSteamBoiler(on);
        if (success) {
            this.state.steamOn = on;
        }
        else {
            setInterval(() => this.steamSwitch.updateCharacteristic(this.platform.Characteristic.On, !on), 500);
        }
    }
    // ──────────────────────────────────────────────────────────────────
    // ECO MODUS
    // ──────────────────────────────────────────────────────────────────
    async setEcoMode(value) {
        const on = value;
        this.platform.log.info(`ECO modus ${on ? 'inschakelen' : 'uitschakelen'}...`);
        if (on) {
            const success = await this.api.control(2 /* XeniaAction.EcoMode */);
            if (success) {
                this.state.ecoMode = true;
                this.state.machineOn = false;
                this.mainSwitch.updateCharacteristic(this.platform.Characteristic.On, false);
            }
            else {
                setInterval(() => this.ecoSwitch.updateCharacteristic(this.platform.Characteristic.On, false), 500);
            }
        }
        else {
            const success = await this.api.control(1 /* XeniaAction.PowerOn */);
            if (success) {
                this.state.ecoMode = false;
                this.state.machineOn = true;
                this.mainSwitch.updateCharacteristic(this.platform.Characteristic.On, true);
            }
            else {
                setInterval(() => this.ecoSwitch.updateCharacteristic(this.platform.Characteristic.On, true), 500);
            }
        }
    }
    // ──────────────────────────────────────────────────────────────────
    // DOELTEMPERATUUR
    // ──────────────────────────────────────────────────────────────────
    async setTargetTemperature(value) {
        const temp = value;
        this.platform.log.info(`Boiler doeltemperatuur instellen op ${temp}°C...`);
        const success = await this.api.setTemperatures(temp, temp);
        if (success) {
            this.state.targetTemp = temp;
            this.platform.log.info(`Boiler doeltemperatuur ingesteld op ${temp}°C`);
        }
    }
}
exports.XeniaMachineAccessory = XeniaMachineAccessory;
//# sourceMappingURL=accessory.js.map