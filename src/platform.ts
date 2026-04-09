import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { XeniaMachineAccessory } from './accessory';

/**
 * XeniaPlatform — het hoofdplatform van de plugin.
 * Registreert en beheert alle accessories voor de espressomachine.
 */
export class XeniaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // Cache van herstelde accessories (zodat we geen duplicaten maken)
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
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
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info(`Accessory hersteld vanuit cache: ${accessory.displayName}`);
    this.accessories.push(accessory);
  }

  /**
   * Registreer de Xenia espressomachine als accessory in HomeKit.
   */
  discoverDevices() {
    const ip = this.config['ip'] as string;

    if (!ip) {
      this.log.error('Geen IP-adres ingesteld! Vul het IP-adres in bij de plugin configuratie.');
      return;
    }

    // Maak een stabiele UUID op basis van het IP-adres
    const uuid = this.api.hap.uuid.generate(`xenia-espresso-${ip}`);
    const displayName = (this.config['name'] as string) || 'Xenia Espresso';

    // Controleer of accessory al bestaat in cache
    const existingAccessory = this.accessories.find(acc => acc.UUID === uuid);

    if (existingAccessory) {
      this.log.info(`Bestaande accessory gevonden: ${existingAccessory.displayName}`);
      existingAccessory.context['ip'] = ip;
      existingAccessory.context['pollInterval'] = this.config['pollInterval'] ?? 30;
      new XeniaMachineAccessory(this, existingAccessory);
    } else {
      this.log.info(`Nieuwe accessory aanmaken: ${displayName} (${ip})`);
      const accessory = new this.api.platformAccessory(displayName, uuid);
      accessory.context['ip'] = ip;
      accessory.context['pollInterval'] = this.config['pollInterval'] ?? 30;

      new XeniaMachineAccessory(this, accessory);

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }
}
