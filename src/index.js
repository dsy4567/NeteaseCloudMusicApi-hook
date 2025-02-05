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
/** @type {import("../types").InitConfig} */
let config = {};

/**
 * require & hook
 * @param {import("../types").InitConfig?} c
 * @returns {import("../types").InitReturnT}
 */
function init(c = {}) {
    if (hooked) throw new Error("Already initialized.");

    try {
        config = c;
        if (typeof config !== "object" || config === null) config = {};
        setDebugMode(config.debug);
        forceWeapi = !!(config.forceWeapi ?? false);
        forceConnection = !!(config.forceConnection ?? false);

        if (!config.target)
            config.target = require.resolve("NeteaseCloudMusicApi");

        const pathToRequestJs = path.join(config.target, "../util/request.js");
        const pathToCryptoJs = path.join(config.target, "../util/crypto.js");

        require(pathToRequestJs);
        requestJsModule = require.cache[pathToRequestJs];
        cryptoJsExports = require(pathToCryptoJs);
        if (requestJsModule) {
            hook(requestJsModule);
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
 * 返回结果等同与 `require("NeteaseCloudMusicApi")`
 * @returns {any}
 */
function getExports() {
    if (!req) throw new Error("Not initialized.");
    return req;
}
/**
 * 恢复对 NeteaseCloudMusicApi/util/request.js 的 hook
 * @param {NodeJS.Module | undefined} _requestJsModule
 */
function hook(_requestJsModule) {
    if (_requestJsModule) requestJsModule = _requestJsModule;
    else {
        const pathToRequestJs = path.join(config.target, "../util/request.js");
        const pathToCryptoJs = path.join(config.target, "../util/crypto.js");

        require(pathToRequestJs);
        requestJsModule = require.cache[pathToRequestJs];
        cryptoJsExports = require(pathToCryptoJs);
    }
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
    req = require(config.target);
    return hooked;
}
/** 暂停对 NeteaseCloudMusicApi/util/request.js 的 hook */
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
/** 获取 NeteaseCloudMusicApi/util/request.js 的原始导出
 * @returns {any | undefined}
 */
function _getRequestJsOriginalExports() {
    return requestJsOriginalExports;
}
/** 获取 NeteaseCloudMusicApi/util/crypto.js 的导出
 * @returns {any | undefined}
 */
function _getCryptoJsExports() {
    return cryptoJsExports;
}

const options = {
    /** 是否强制要求连接浏览器 */
    forceConnection: {
        get() {
            return forceConnection;
        },
        set(/** @type {Boolean} */ v) {
            return (forceConnection = !!v);
        },
    },
    /** 是否强制使用 weapi */
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
