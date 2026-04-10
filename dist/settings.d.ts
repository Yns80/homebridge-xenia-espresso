/**
 * Plugin naam zoals geregistreerd bij Homebridge.
 * Moet overeenkomen met de naam in package.json.
 */
export declare const PLUGIN_NAME = "homebridge-xenia-espresso";
/**
 * Platform alias — moet overeenkomen met pluginAlias in config.schema.json.
 */
export declare const PLATFORM_NAME = "XeniaEspresso";
/**
 * Xenia API acties voor machine/control endpoint.
 */
export declare const enum XeniaAction {
    PowerOff = 0,
    PowerOn = 1,
    EcoMode = 2,
    SteamBoilerOff = 3,
    SteamBoilerOn = 4,
    PowerOnSteamBoilerOff = 5
}
//# sourceMappingURL=settings.d.ts.map