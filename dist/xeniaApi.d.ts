import { Logger } from 'homebridge';
export declare const MachineStatus: {
    readonly OFF: 0;
    readonly ON: 1;
    readonly ECO: 2;
    readonly BREWING: 3;
    readonly DRAINING: 4;
};
export declare const SteamBoilerStatus: {
    readonly OFF: 1;
    readonly ON: 2;
};
export interface XeniaOverview {
    MA_EXTRACTIONS: number;
    MA_OPERATING_HOURS: number;
    MA_STATUS: number;
    MA_CLOCK: number;
    MA_CUR_PWR: number;
    MA_MAX_PWR: number;
    MA_ENERGY_TOTAL_KWH: number;
    MA_LAST_EXTRACTION_ML: string;
    BG_SENS_TEMP_A: number;
    BG_LEVEL_PW_CONTROL: number;
    BB_SENS_TEMP_A: number;
    BB_LEVEL_PW_CONTROL: number;
    PU_SENS_PRESS: number;
    PU_LEVEL_PW_CONTROL: number;
    PU_SET_LEVEL_PW_CONTROL: number;
    PU_SENS_FLOW_METER_ML: number;
    SB_SENS_PRESS: number;
    SB_STATUS: number;
    SCALE_WEIGHT: number;
}
export interface XeniaOverviewSingle {
    BG_SET_TEMP: number;
    BB_SET_TEMP: number;
    PU_SET_PRESS: number;
    SB_SET_PRESS: number;
    PU_SENS_WATER_TANK_LEVEL: number;
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
export declare class XeniaApi {
    private readonly ip;
    private readonly log;
    constructor(ip: string, log: Logger);
    private request;
    private get;
    private post;
    /** Full overview: temperatures, pressure, status, flow, scale */
    getOverview(): Promise<XeniaOverview | null>;
    /** Settings: target temperatures, water tank level */
    getOverviewSingle(): Promise<XeniaOverviewSingle | null>;
    /** Machine type and firmware versions */
    getMachine(): Promise<XeniaMachine | null>;
    /** List user scripts: returns { id: name } */
    getScripts(): Promise<Record<number, string> | null>;
    /** Machine control — action codes:
     *  0=OFF, 1=ON (with steam), 2=ECO, 3=SB_OFF, 4=SB_ON, 5=ON_SB_OFF
     *  Values sent as strings per Xenia API: {"action":"1"} */
    control(action: number): Promise<boolean>;
    /** Toggle steam boiler on/off */
    toggleSteamBoiler(on: boolean): Promise<boolean>;
    /** Set brew group + brew boiler target temperature */
    setTemperatures(bgTemp: number, bbTemp: number): Promise<boolean>;
    /** Set brew boiler target temperature only */
    setBrewBoilerTemp(bbTemp: number): Promise<boolean>;
    /** Execute a script on the machine */
    executeScript(scriptId: number): Promise<boolean>;
}
//# sourceMappingURL=xeniaApi.d.ts.map