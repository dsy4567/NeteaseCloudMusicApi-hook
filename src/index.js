// @ts-check
"use srtict";

const path = require("path");
const { log, setDebugMode } = require("./utils");
const server = require("./server");

let hooked = false,
    /** @type {any | null} */
    req = null,
    requestJsOriginalExports,
    cryptoJsExports,
    forceWeapi = false,
    forceConnection = false;
/** @type {NodeJS.Module | undefined} */
let requestJsModule;

/**
 * require & hook
 * @param {import("../types").InitConfig?} config
 * @returns {import("../types").InitReturnT}
 */
function init(config = {}) {
    if (hooked) throw new Error("Already initialized.");

    try {
        if (typeof config !== "object" || config === null) config = {};
        setDebugMode(config.debug);
        forceWeapi = !!(config.forceWeapi ?? false);
        forceConnection = !!(config.forceConnection ?? false);

        if (!config.pathToJs)
            config.pathToJs = require.resolve("NeteaseCloudMusicApi");

        const pathToRequestJs = path.join(
            config.pathToJs,
            "../util/request.js"
        );
        const pathToCryptoJs = path.join(config.pathToJs, "../util/crypto.js");

        req = require(config.pathToJs);
        requestJsModule = require.cache[pathToRequestJs];
        cryptoJsExports = require(pathToCryptoJs);
        if (requestJsModule) {
            hook();
            log("request.js hooked:", pathToRequestJs);
        } else {
            unhook();
            throw new Error("Hook failed.");
        }

        /** @type {import("../types").ServerStatus} */
        let serverStatus;
        try {
            serverStatus = server.start(
                config.serverPort,
                config.serverHost,
                config.connectionToken
            );
        } catch (e) {
            throw e;
        }
        return {
            exports: req,
            serverStatus,
        };
    } catch (e) {
        unhook();
        throw e;
    }
}
/**
 * @returns {any}
 */
function getExports() {
    if (!req) throw new Error("Not initialized.");
    return req;
}
function hook() {
    if (
        requestJsModule &&
        // @ts-ignore
        !requestJsModule?._originalExports
    ) {
        // @ts-ignore
        requestJsOriginalExports = requestJsModule._originalExports =
            requestJsModule.exports;
        requestJsModule.exports = require("./hooks/request");

        hooked = true;
    }
    return hooked;
}
function unhook() {
    if (
        requestJsModule &&
        // @ts-ignore
        requestJsModule?._originalExports
    ) {
        // @ts-ignore
        requestJsModule.exports = requestJsModule._originalExports;
        // @ts-ignore
        delete requestJsModule._originalExports;

        hooked = false;
    }
    return hooked;
}
/**
 * @returns {any | undefined}
 */
function _getRequestJsOriginalExports() {
    return requestJsOriginalExports;
}
/**
 * @returns {any | undefined}
 */
function _getCryptoJsExports() {
    return cryptoJsExports;
}

const options = {
    forceConnection: {
        get() {
            return forceConnection;
        },
        set(/** @type {Boolean} */ v) {
            return (forceConnection = !!v);
        },
    },
    forceWeapi: {
        get() {
            return forceWeapi;
        },
        set(/** @type {Boolean} */ v) {
            return (forceWeapi = !!v);
        },
    },
};

module.exports = {
    init,
    setDebugMode,
    getExports,
    hook,
    unhook,
    server: {
        getServerStatus: server.getStatus,
        start: server.start,
        stop: server.stop,
        _createRequest: server.createRequest,
    },
    loginStatus: server.loginStatus,
    additionalApis: server.additionalApis,
    _getCryptoJsExports,
    _getRequestJsOriginalExports,
    options,
};
