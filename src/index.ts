import { API } from 'homebridge';
import { XeniaPlatform } from './platform';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

/**
 * Entry point van de Homebridge plugin.
 * Hier registreren we het platform bij Homebridge.
 */
export = (api: API) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, XeniaPlatform);
};
