"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XeniaPlatform = void 0;
const settings_1 = require("./settings");
const accessory_1 = require("./accessory");
/**
 * XeniaPlatform — het hoofdplatform van de plugin.
 * Registreert en beheert alle accessories voor de espressomachine.
 */
class XeniaPlatform {
    log;
    config;
    api;
    Service;
    Characteristic;
    // Cache van herstelde accessories (zodat we geen duplicaten maken)
    accessories = [];
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.log.debug('XeniaPlatform initialiseren...');
        // Wacht tot Homebridge klaar is voordat we accessories toevoegen
        this.api.on('didFinishLaunching', () => {
            this.log.debug('didFinishLaunching — accessories ontdekken');
            this.discoverDevices();
        });
    }
    /**
     * Wordt aangeroepen door Homebridge bij het herstellen van gecachede accessories.
     */
    configureAccessory(accessory) {
        this.log.info(`Accessory hersteld vanuit cache: ${accessory.displayName}`);
        this.accessories.push(accessory);
    }
    /**
     * Registreer de Xenia espressomachine als accessory in HomeKit.
     */
    discoverDevices() {
        const ip = this.config['ip'];
        if (!ip) {
            this.log.error('Geen IP-adres ingesteld! Vul het IP-adres in bij de plugin configuratie.');
            return;
        }
        // Maak een stabiele UUID op basis van het IP-adres
        const uuid = this.api.hap.uuid.generate(`xenia-espresso-${ip}`);
        const displayName = this.config['name'] || 'Xenia Espresso';
        // Controleer of accessory al bestaat in cache
        const existingAccessory = this.accessories.find(acc => acc.UUID === uuid);
        if (existingAccessory) {
            this.log.info(`Bestaande accessory gevonden: ${existingAccessory.displayName}`);
            existingAccessory.context['ip'] = ip;
            existingAccessory.context['pollInterval'] = this.config['pollInterval'] ?? 30;
            new accessory_1.XeniaMachineAccessory(this, existingAccessory);
        }
        else {
            this.log.info(`Nieuwe accessory aanmaken: ${displayName} (${ip})`);
            const accessory = new this.api.platformAccessory(displayName, uuid);
            accessory.context['ip'] = ip;
            accessory.context['pollInterval'] = this.config['pollInterval'] ?? 30;
            new accessory_1.XeniaMachineAccessory(this, accessory);
            this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
        }
    }
}
exports.XeniaPlatform = XeniaPlatform;
//# sourceMappingURL=platform.js.map