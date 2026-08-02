import { Logger } from 'homebridge';
export interface XeniaStatus {
    MA_STATUS: number;
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
export declare class XeniaApi {
    private readonly ip;
    private readonly log;
    constructor(ip: string, log: Logger);
    private httpGet;
    private httpPost;
    getStatus(): Promise<XeniaStatus | null>;
    getOverview(): Promise<XeniaOverview | null>;
    getOverviewSingle(): Promise<XeniaOverviewSingle | null>;
    getMachineInfo(): Promise<XeniaMachineInfo | null>;
    getDiagram(): Promise<XeniaDiagram | null>;
    /** Machine aan/uit/eco: 0=uit, 1=aan, 2=eco, 3=stoom uit, 4=stoom aan, 5=aan+stoom uit */
    control(action: number): Promise<boolean>;
    /** Stoomboiler aan/uit */
    toggleSteamBoiler(on: boolean): Promise<boolean>;
    /** Koffieboiler temperatuur aanpassen (+0.1 of -0.1) */
    incDecBrewBoiler(delta: number): Promise<boolean>;
    /** Stoomboiler druk aanpassen (+0.1 of -0.1) */
    incDecSteamBoiler(delta: number): Promise<boolean>;
    /** Brewgroup + koffieboiler doeltemperatuur direct instellen */
    setTemperatures(bgTemp: number, bbTemp: number): Promise<boolean>;
    /** Machine instellingen aanpassen */
    setMachineSettings(settings: {
        MA_SET_TIMER_ECO_MA?: number;
        MA_SET_TIMER_POWERDOWN?: number;
        MA_FIX_WATER_SUPPLY?: number;
        MA_MAX_AMPERE?: number;
        MA_HEATUP_FLUSH_EN?: number;
    }): Promise<boolean>;
    /** Script uitvoeren */
    executeScript(scriptId: number): Promise<boolean>;
}
//# sourceMappingURL=xeniaApi.d.ts.map