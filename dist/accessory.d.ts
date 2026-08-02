import { PlatformAccessory } from 'homebridge';
import { XeniaPlatform } from './platform';
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
export declare class XeniaMachineAccessory {
    private readonly platform;
    private readonly accessory;
    private mainSwitch;
    private steamSwitch;
    private ecoSwitch;
    private brewBoilerTempSensor;
    private brewGroupTempSensor;
    private thermostat;
    private waterSensor;
    private infoService;
    private readonly api;
    private pollTimer;
    private state;
    constructor(platform: XeniaPlatform, accessory: PlatformAccessory);
    private fetchMachineInfo;
    private pollStatus;
    private setMachineOn;
    private setSteamOn;
    private setEcoMode;
    private setTargetTemperature;
}
//# sourceMappingURL=accessory.d.ts.map