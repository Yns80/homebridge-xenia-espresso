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
    /**
     * List the scripts stored on the machine, normalised to `{ <id>: <name> }`.
     *
     * The Xenia firmware has used a few shapes for `/scripts/list` over the
     * years — an `{ "1": "Name" }` object, a `{ "SCRIPTS": [...] }` wrapper, an
     * array of `{ ID, NAME }` objects, or a plain array of names — so we accept
     * all of them and log the raw response (it's invaluable when a machine
     * returns something unexpected). Returns `null` when the request failed or
     * the machine returned nothing (so cached buttons are kept); an empty object
     * `{}` means "connected, but no scripts".
     */
    async getScripts() {
        const raw = await this.request('GET', '/scripts/list');
        this.log.info('[XeniaAPI] /scripts/list -> ' + JSON.stringify(raw));
        if (raw == null ||
            (Array.isArray(raw) && raw.length === 0) ||
            (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0)) {
            return null;
        }
        const result = {};
        const put = (id, name, fallbackId) => {
            let nId = Number(id);
            if (!Number.isFinite(nId)) {
                nId = fallbackId;
            }
            if (!Number.isFinite(nId)) {
                return;
            }
            const nName = (name === undefined || name === null) ? '' : String(name).trim();
            result[nId] = nName || `Script ${nId}`;
        };
        const pick = (o, keys) => {
            for (const k of keys) {
                if (o[k] !== undefined && o[k] !== null) {
                    return o[k];
                }
            }
            return undefined;
        };
        // Unwrap a single { SCRIPTS: ... } / { scripts: ... } wrapper.
        let data = raw;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            const obj = data;
            const keys = Object.keys(obj);
            if (keys.length === 1 && keys[0].toLowerCase() === 'scripts') {
                data = obj[keys[0]];
            }
        }
        if (Array.isArray(data)) {
            data.forEach((entry, i) => {
                if (entry && typeof entry === 'object') {
                    const o = entry;
                    put(pick(o, ['ID', 'Id', 'id', 'INDEX', 'index']) ?? i, pick(o, ['NAME', 'Name', 'name', 'TITLE', 'title']), i);
                }
                else {
                    put(i, entry, i);
                }
            });
        }
        else if (data && typeof data === 'object') {
            let i = 0;
            for (const [k, v] of Object.entries(data)) {
                if (v && typeof v === 'object') {
                    const o = v;
                    put(pick(o, ['ID', 'Id', 'id']) ?? k, pick(o, ['NAME', 'Name', 'name', 'TITLE', 'title']) ?? k, Number(k));
                }
                else {
                    put(k, v, i);
                }
                i++;
            }
        }
        return result;
    }
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
    /** Stop whichever script is currently running (GET, no parameters) */
    async stopScript() { await this.request('GET', '/scripts/stop'); return true; }
}
exports.XeniaApi = XeniaApi;
//# sourceMappingURL=xeniaApi.js.map