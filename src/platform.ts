import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { XeniaMachineAccessory } from './accessory';

export class XeniaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  private readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.accessories.push(accessory);
  }

  discoverDevices() {
    const machines = (this.config['machines'] as Array<{ ip: string; name: string; pollInterval?: number }>) ?? [];

    for (const machine of machines) {
      const uuid = this.api.hap.uuid.generate(machine.ip);
      const existing = this.accessories.find(a => a.UUID === uuid);

      if (existing) {
        existing.context['ip'] = machine.ip;
        existing.context['pollInterval'] = machine.pollInterval ?? 10;
        new XeniaMachineAccessory(this, existing);
      } else {
        const accessory = new this.api.platformAccessory(machine.name, uuid);
        accessory.context['ip'] = machine.ip;
        accessory.context['pollInterval'] = machine.pollInterval ?? 10;
        new XeniaMachineAccessory(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
