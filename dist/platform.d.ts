import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
/**
 * XeniaPlatform — het hoofdplatform van de plugin.
 * Registreert en beheert alle accessories voor de espressomachine.
 */
export declare class XeniaPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: PlatformAccessory[];
    constructor(log: Logger, config: PlatformConfig, api: API);
    /**
     * Wordt aangeroepen door Homebridge bij het herstellen van gecachede accessories.
     */
    configureAccessory(accessory: PlatformAccessory): void;
    /**
     * Registreer de Xenia espressomachine als accessory in HomeKit.
     */
    discoverDevices(): void;
}
//# sourceMappingURL=platform.d.ts.map