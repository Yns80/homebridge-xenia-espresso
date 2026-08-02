/**
 * Plugin naam zoals geregistreerd bij Homebridge.
 * Moet overeenkomen met de naam in package.json.
 */
export const PLUGIN_NAME = 'homebridge-xenia-espresso';

/**
 * Platform alias — moet overeenkomen met pluginAlias in config.schema.json.
 */
export const PLATFORM_NAME = 'XeniaEspresso';

/**
 * Xenia API acties voor machine/control endpoint.
 */
export const enum XeniaAction {
  PowerOff = 0,
  PowerOn = 1,
  EcoMode = 2,
  SteamBoilerOff = 3,
  SteamBoilerOn = 4,
  PowerOnSteamBoilerOff = 5,
}
