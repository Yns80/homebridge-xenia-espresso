"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XeniaApi = exports.SteamBoilerStatus = exports.MachineStatus = void 0;
const http = require("http");
// MA_STATUS values
exports.MachineStatus = { OFF: 0, ON: 1, ECO: 2, BREWING: 3, DRAINING: 4 };
// SB_STATUS values — NOTE: OFF=1, ON=2 (not 0/1)
exports.SteamBoilerStatus = { OFF: 1, ON: 2 };
class XeniaApi {
    ip;
    log;
    constructor(ip, log) {
        this.ip = ip;
        this.log = log;
    }
    request(method, path, body) {
        return new Promise((resolve) => {
            const data = body ? JSON.stringify(body) : undefined;
            // POST: Xenia requires JSON body with application/x-www-form-urlencoded Content-Type
            const contentType = method === 'POST'
                ? 'application/x-www-form-urlencoded'
                : 'application/json';
            const opts = {
                hostname: this.ip,
                port: 80,
                path: '/api/v2' + path,
                method,
                headers: {
                    'Content-Type': contentType,
                    'Connection': 'close',
                    ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
                },
                agent: false,
            };
            const req = http.request(opts, (res) => {
                let raw = '';
                res.on('data', (chunk) => { raw += chunk.toString(); });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(raw));
                    }
                    catch {
                        resolve({});
                    }
                });
            });
            // ECONNRESET/EPIPE are expected on POST — Xenia closes the socket after responding
            req.on('error', (e) => {
                if (e.code !== 'ECONNRESET' && e.code !== 'EPIPE') {
                    this.log.warn('[XeniaAPI] Request error on ' + method + ' ' + path + ': ' + e.message);
                }
                resolve({});
            });
            req.setTimeout(8000, () => { req.destroy(); resolve({}); });
            if (data) {
                req.write(data);
            }
            req.end();
        });
    }
    async get(path) {
        const r = await this.request('GET', path);
        if (Object.keys(r).length === 0) {
            this.log.warn('[XeniaAPI] No data from GET ' + path);
            return null;
        }
        return r;
    }
    async post(path, body) {
        await this.request('POST', path, body);
        return true;
    }
    /** Full overview: temperatures, pressure, status, flow, scale */
    async getOverview() { return this.get('/overview'); }
    /** Settings: target temperatures, water tank level */
    async getOverviewSingle() { return this.get('/overview_single'); }
    /** Machine type and firmware versions */
    async getMachine() { return this.get('/machine'); }
    /** List user scripts: returns { id: name } */
    async getScripts() { return this.get('/scripts/list'); }
    /** Machine control — action codes:
     *  0=OFF, 1=ON (with steam), 2=ECO, 3=SB_OFF, 4=SB_ON, 5=ON_SB_OFF
     *  Values sent as strings per Xenia API: {"action":"1"} */
    async control(action) { return this.post('/machine/control/', { action: String(action) }); }
    /** Toggle steam boiler on/off */
    async toggleSteamBoiler(on) { return this.post('/toggle_sb', { TOGGLE: String(on) }); }
    /** Set brew group + brew boiler target temperature */
    async setTemperatures(bgTemp, bbTemp) {
        return this.post('/inc_dec', { BG_SET_TEMP: String(bgTemp), BB_SET_TEMP: String(bbTemp) });
    }
    /** Set brew boiler target temperature only */
    async setBrewBoilerTemp(bbTemp) {
        return this.post('/inc_dec_bb', { BB_SET_TEMP: String(bbTemp) });
    }
    /** Execute a script on the machine */
    async executeScript(scriptId) { return this.post('/scripts/execute/', { ID: String(scriptId) }); }
}
exports.XeniaApi = XeniaApi;
//# sourceMappingURL=xeniaApi.js.map