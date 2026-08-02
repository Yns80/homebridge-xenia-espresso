"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XeniaApi = void 0;
const http = require("http");
/**
 * HTTP client voor de Xenia ESP32 API v2.
 * Quirk: POST requests verwachten JSON body maar met
 * Content-Type: application/x-www-form-urlencoded header.
 * ECONNRESET na POST = succes (ESP32 sluit socket na response).
 */
class XeniaApi {
    ip;
    log;
    constructor(ip, log) {
        this.ip = ip;
        this.log = log;
    }
    httpGet(path) {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: this.ip, port: 80,
                path: '/api/v2' + path, method: 'GET',
                agent: false,
                headers: { 'Connection': 'close' },
            }, (res) => {
                let raw = '';
                res.on('data', (c) => { raw += c.toString(); });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(raw));
                    }
                    catch {
                        resolve(null);
                    }
                });
            });
            req.on('error', () => resolve(null));
            req.setTimeout(6000, () => { req.destroy(); resolve(null); });
            req.end();
        });
    }
    httpPost(path, body) {
        return new Promise((resolve) => {
            // JSON body + form-urlencoded Content-Type = de Xenia API quirk
            const data = JSON.stringify(body);
            const req = http.request({
                hostname: this.ip, port: 80,
                path: '/api/v2' + path, method: 'POST',
                agent: false,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(data),
                    'Connection': 'close',
                },
            }, (res) => {
                this.log.debug(`[XeniaAPI] POST ${path} -> ${res.statusCode}`);
                res.resume();
                res.on('end', () => resolve(true));
            });
            req.on('error', (e) => {
                // ECONNRESET = ESP32 sluit socket na response = succes
                if (e.code === 'ECONNRESET' || e.code === 'EPIPE') {
                    resolve(true);
                }
                else {
                    this.log.warn(`[XeniaAPI] POST ${path} error: ${e.message}`);
                    resolve(false);
                }
            });
            req.setTimeout(6000, () => { req.destroy(); resolve(false); });
            req.write(data);
            req.end();
        });
    }
    // ── GET endpoints ──────────────────────────────────────────────────
    async getStatus() {
        return this.httpGet('/status');
    }
    async getOverview() {
        return this.httpGet('/overview');
    }
    async getOverviewSingle() {
        return this.httpGet('/overview_single');
    }
    async getMachineInfo() {
        return this.httpGet('/machine');
    }
    async getDiagram() {
        return this.httpGet('/diagram_get');
    }
    // ── POST endpoints ─────────────────────────────────────────────────
    /** Machine aan/uit/eco: 0=uit, 1=aan, 2=eco, 3=stoom uit, 4=stoom aan, 5=aan+stoom uit */
    async control(action) {
        return this.httpPost('/machine/control', { action: String(action) });
    }
    /** Stoomboiler aan/uit */
    async toggleSteamBoiler(on) {
        return this.httpPost('/toggle_sb', { TOGGLE: on });
    }
    /** Koffieboiler temperatuur aanpassen (+0.1 of -0.1) */
    async incDecBrewBoiler(delta) {
        return this.httpPost('/inc_dec_bb', { BB_SET_TEMP: delta });
    }
    /** Stoomboiler druk aanpassen (+0.1 of -0.1) */
    async incDecSteamBoiler(delta) {
        return this.httpPost('/inc_dec_sb', { SB_SET_PRESS: delta });
    }
    /** Brewgroup + koffieboiler doeltemperatuur direct instellen */
    async setTemperatures(bgTemp, bbTemp) {
        return this.httpPost('/inc_dec', { BG_SET_TEMP: bgTemp, BB_SET_TEMP: bbTemp });
    }
    /** Machine instellingen aanpassen */
    async setMachineSettings(settings) {
        return this.httpPost('/machine', settings);
    }
    /** Script uitvoeren */
    async executeScript(scriptId) {
        return this.httpPost('/scripts/execute/', { ID: String(scriptId) });
    }
}
exports.XeniaApi = XeniaApi;
//# sourceMappingURL=xeniaApi.js.map