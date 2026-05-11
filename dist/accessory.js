"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XeniaMachineAccessory = void 0;
const xeniaApi_1 = require("./xeniaApi");
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
 *   - TemperatureSensor "Steam Boiler Pressure" → SB_SENS_PRESS (bar, displayed as °C in HomeKit)
 *   - TemperatureSensor "Pump Pressure"         → PU_SENS_PRESS (bar, displayed as °C in HomeKit)
 *   - Switch (momentary) per machine script     → /scripts/list + /scripts/execute/
 *       (pressure profiles, pre-infusion, ...; flip on = run, auto-resets to off)
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
    _waterTankType = 'filter';
    steamPressureSensor;
    pumpPressureSensor;
    infoService;
    api;
    _pollTimer = null;
    state = {
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
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        const ip = accessory.context['ip'];
        const pollInterval = accessory.context['pollInterval'] * 1000;
        this.api = new xeniaApi_1.XeniaApi(ip, platform.log);
        // ── Accessory informatie ──────────────────────────────────────────
        this.infoService =
            this.accessory.getService(this.platform.Service.AccessoryInformation)
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
        const waterTankType = this.platform.config['waterTankSensor'] || 'filter';
        this._waterTankType = waterTankType;
        const allWaterSubtypes = ['water-filter', 'water-contact', 'water-sensor'];
        const waterServiceMap = {
            filter: { ServiceCtor: this.platform.Service.FilterMaintenance, subtype: 'water-filter' },
            contact: { ServiceCtor: this.platform.Service.ContactSensor, subtype: 'water-contact' },
            leak: { ServiceCtor: this.platform.Service.LeakSensor, subtype: 'water-sensor' },
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
            const watchedChar = waterTankType === 'filter' ? this.platform.Characteristic.FilterChangeIndication :
                waterTankType === 'contact' ? this.platform.Characteristic.ContactSensorState :
                    this.platform.Characteristic.LeakDetected;
            this.waterSensor.getCharacteristic(watchedChar)
                .onGet(() => this.state.waterEmpty ? 1 : 0);
        }
        // ── Steam Boiler Pressure (SB_SENS_PRESS) ────────────────────────
        // HomeKit has no native pressure service. We use TemperatureSensor so
        // the Home app tile shows the actual numeric value (the °C unit label
        // is wrong but the number is right; users typically rename the tile).
        // Cleanup any stale AirQualitySensor from earlier plugin versions.
        for (const service of [...this.accessory.services]) {
            if (service.subtype === 'steam-pressure' && service.UUID !== this.platform.Service.TemperatureSensor.UUID) {
                this.platform.log.info(`Removing stale steam pressure service (was ${service.UUID})`);
                this.accessory.removeService(service);
            }
        }
        this.steamPressureSensor =
            this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'steam-pressure') ||
                this.accessory.addService(this.platform.Service.TemperatureSensor, 'Steam Boiler Pressure', 'steam-pressure');
        this.steamPressureSensor
            .setCharacteristic(this.platform.Characteristic.Name, 'Steam Boiler Pressure')
            .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Steam Boiler Pressure');
        this.steamPressureSensor.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .setProps({ minValue: -50, maxValue: 50, minStep: 0.01 })
            .onGet(() => this.state.steamPressure);
        // ── Pump Pressure (PU_SENS_PRESS) ────────────────────────────────
        // Same approach as steam pressure: TemperatureSensor for numeric display.
        for (const service of [...this.accessory.services]) {
            if (service.subtype === 'pump-pressure' && service.UUID !== this.platform.Service.TemperatureSensor.UUID) {
                this.platform.log.info(`Removing stale pump pressure service (was ${service.UUID})`);
                this.accessory.removeService(service);
            }
        }
        this.pumpPressureSensor =
            this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'pump-pressure') ||
                this.accessory.addService(this.platform.Service.TemperatureSensor, 'Pump Pressure', 'pump-pressure');
        this.pumpPressureSensor
            .setCharacteristic(this.platform.Characteristic.Name, 'Pump Pressure')
            .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Pump Pressure');
        this.pumpPressureSensor.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .setProps({ minValue: -50, maxValue: 50, minStep: 0.01 })
            .onGet(() => this.state.pumpPressure);
        // ── Script buttons (one momentary switch per machine script) ──────
        this.setupScriptButtons();
        // ── Start polling ─────────────────────────────────────────────────
        this.pollStatus();
        this._pollTimer = setInterval(() => this.pollStatus(), pollInterval);
        this.platform.log.info(`Xenia accessory klaar — IP: ${ip}, polling elke ${pollInterval / 1000}s`);
    }
    // ──────────────────────────────────────────────────────────────────
    // SCRIPT KNOPPEN
    // ──────────────────────────────────────────────────────────────────
    /**
     * Maakt een momentane Switch ("knop") voor elk script dat op de machine
     * staat (drukprofielen, pre-infusie, ...). De plugin kan zelf geen scripts
     * aanmaken — die maak je op de machine; deze knoppen voeren ze alleen uit.
     */
    async setupScriptButtons() {
        const exposeScripts = this.platform.config['exposeScripts'] !== false; // standaard aan
        let scripts = {};
        if (exposeScripts) {
            scripts = await this.api.getScripts();
            if (scripts === null) {
                // Machine niet bereikbaar bij het opstarten — bestaande (gecachede)
                // scriptknoppen behouden en alleen hun handlers opnieuw koppelen
                // (handlers overleven een herstart niet).
                this.platform.log.warn('[Xenia] Scriptlijst niet beschikbaar — scriptknoppen worden niet vernieuwd');
                for (const service of this.accessory.services) {
                    if (service.subtype?.startsWith('script-')) {
                        this.wireScriptButton(service, Number(service.subtype.slice('script-'.length)));
                    }
                }
                return;
            }
        }
        const wanted = new Set();
        for (const [idStr, rawName] of Object.entries(scripts)) {
            const id = Number(idStr);
            if (!Number.isFinite(id)) {
                continue;
            }
            const subtype = `script-${id}`;
            wanted.add(subtype);
            const name = String(rawName).trim() || `Script ${id}`;
            const service = this.accessory.getServiceById(this.platform.Service.Switch, subtype) ||
                this.accessory.addService(this.platform.Service.Switch, name, subtype);
            service
                .setCharacteristic(this.platform.Characteristic.Name, name)
                .setCharacteristic(this.platform.Characteristic.ConfiguredName, name);
            this.wireScriptButton(service, id);
            this.platform.log.info(`[Xenia] Scriptknop beschikbaar: "${name}" (id ${id})`);
        }
        // Verwijder scriptknoppen die niet meer op de machine staan (of allemaal
        // wanneer de functie is uitgeschakeld).
        for (const service of [...this.accessory.services]) {
            if (service.subtype?.startsWith('script-') && !wanted.has(service.subtype)) {
                this.platform.log.info(`[Xenia] Verwijder verouderde scriptknop: ${service.subtype}`);
                this.accessory.removeService(service);
            }
        }
    }
    wireScriptButton(service, scriptId) {
        service.getCharacteristic(this.platform.Characteristic.On)
            .onGet(() => false)
            .onSet(async (value) => {
            if (!value) {
                return;
            }
            this.platform.log.info(`[Xenia] Script ${scriptId} uitvoeren...`);
            const ok = await this.api.executeScript(scriptId);
            if (ok) {
                this.platform.log.info(`[Xenia] Script ${scriptId} gestart`);
            }
            else {
                this.platform.log.warn(`[Xenia] Script ${scriptId} kon niet worden gestart`);
            }
            // Momentane "knop": kort daarna weer uitschakelen.
            setTimeout(() => service.updateCharacteristic(this.platform.Characteristic.On, false), 1000);
        });
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
            // MA_STATUS: 0=OFF, 1=ON, 2=ECO, 3=BREWING, 4=DRAINING
            // Machine counts as "on" while brewing or draining too
            const machineOn = overview.MA_STATUS === xeniaApi_1.MachineStatus.ON
                || overview.MA_STATUS === xeniaApi_1.MachineStatus.BREWING
                || overview.MA_STATUS === xeniaApi_1.MachineStatus.DRAINING;
            const ecoMode = overview.MA_STATUS === xeniaApi_1.MachineStatus.ECO;
            const brewing = overview.MA_STATUS === xeniaApi_1.MachineStatus.BREWING;
            // SB_STATUS: 1=OFF, 2=ON (not 0/1 — this was a bug)
            const steamOn = overview.SB_STATUS === xeniaApi_1.SteamBoilerStatus.ON;
            const brewBoilerTemp = Math.round(overview.BB_SENS_TEMP_A * 10) / 10;
            const brewGroupTemp = Math.round(overview.BG_SENS_TEMP_A * 10) / 10;
            const steamPressure = Math.round(overview.SB_SENS_PRESS * 100) / 100;
            const pumpPressure = Math.round(overview.PU_SENS_PRESS * 100) / 100;
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
                this.steamPressureSensor.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, steamPressure);
            }
            if (this.state.pumpPressure !== pumpPressure) {
                this.state.pumpPressure = pumpPressure;
                this.pumpPressureSensor.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, pumpPressure);
            }
            const statusLabel = brewing ? 'BREWING' : overview.MA_STATUS === xeniaApi_1.MachineStatus.DRAINING ? 'DRAINING' : machineOn ? 'ON' : ecoMode ? 'ECO' : 'OFF';
            this.platform.log.info(`[Xenia] ${statusLabel} | ` +
                `boiler: ${brewBoilerTemp}°C | group: ${brewGroupTemp}°C | ` +
                `steam: ${steamPressure} bar | pump: ${pumpPressure} bar | ` +
                `shots: ${overview.MA_EXTRACTIONS} | last: ${overview.MA_LAST_EXTRACTION_ML} ml | ` +
                `flow: ${overview.PU_SENS_FLOW_METER_ML} ml | scale: ${overview.SCALE_WEIGHT} g | ` +
                `power: ${overview.MA_CUR_PWR} W | ${opHours} hrs`);
            // Accessory Information tile (Home app ⓘ details)
            this.infoService
                .setCharacteristic(this.platform.Characteristic.FirmwareRevision, `${overview.MA_EXTRACTIONS} shots | ${opHours} hrs`)
                .setCharacteristic(this.platform.Characteristic.HardwareRevision, `Last: ${overview.MA_LAST_EXTRACTION_ML} ml | ${overview.MA_CUR_PWR} W`);
        }
        if (single) {
            const waterEmpty = single.PU_SENS_WATER_TANK_LEVEL === 0;
            const targetTemp = single.BB_SET_TEMP;
            if (this.state.waterEmpty !== waterEmpty) {
                this.state.waterEmpty = waterEmpty;
                if (this.waterSensor && this._waterTankType !== 'none') {
                    const watchedChar = this._waterTankType === 'filter' ? this.platform.Characteristic.FilterChangeIndication :
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
        if (!success) {
            setInterval(() => this.steamSwitch.updateCharacteristic(this.platform.Characteristic.On, !on), 500);
        }
        else {
            this.state.steamOn = on;
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