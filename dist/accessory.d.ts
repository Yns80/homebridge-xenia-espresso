import { PlatformAccessory } from 'homebridge';
import { XeniaPlatform } from './platform';
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
export declare class XeniaMachineAccessory {
    private readonly platform;
    private readonly accessory;
    private mainSwitch;
    private steamSwitch;
    private ecoSwitch;
    private brewBoilerTempSensor;
    private brewGroupTempSensor;
    private thermostat;
    private waterSensor?;
    private _waterTankType;
    private steamPressureSensor;
    private pumpPressureSensor;
    private infoService;
    private readonly api;
    private _pollTimer;
    private state;
    constructor(platform: XeniaPlatform, accessory: PlatformAccessory);
    /**
     * Creates a momentary Switch ("button") for every script stored on the
     * machine (pressure profiles, pre-infusion, ...), plus a single generic
     * "Stop Script" button that aborts whichever script is running. The plugin
     * cannot create scripts — you author those on the machine; these buttons
     * only run / stop them.
     */
    private setupScriptButtons;
    private wireScriptButton;
    private pollStatus;
    private setMachineOn;
    private setSteamOn;
    private setEcoMode;
    private setTargetTemperature;
}
//# sourceMappingURL=accessory.d.ts.map