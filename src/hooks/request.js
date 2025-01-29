// @ts-check
"use strict";

const { log } = require("../utils");

const weapiDomain = "https://music.163.com";

/**
 * hook createRequest in NeteaseCloudMusicApi/util/request.js
 * @param {String} uri /api/xxx
 * @param {*} data
 * @param {{crypto?: 'api' | 'weapi' | 'eapi' | 'linuxapi'}} options
 * @param {{} | undefined} oldNcmApiOptions 用于旧版 NeteaseCloudMusicApi 检测，请勿传此参
 * @returns {Promise<import("../../types").createRequestReturnT>}
 */
// async function createRequest(method, url, data = {}, options = {})
async function createRequest(uri, data = {}, options = {}, oldNcmApiOptions) {
    return new Promise((resolve, reject) => {
        // 根据传入的参数检测旧版 NeteaseCloudMusicApi
        if (
            typeof (/** method */ uri) === "string" &&
            typeof (/** url */ data) === "string" &&
            // typeof (/** data */ options) !== "???" &&
            typeof (/** options */ oldNcmApiOptions) !== "undefined"
        )
            return reject({
                body: {
                    code: 502,
                    msg: "[NeteaseCloudMusicApi-hook] Too many or invalid arguments. Are you using an older or invalid version of NeteaseCloudMusicApi?",
                },
                cookie: [],
                status: 502,
            });
        if (typeof options !== "object" || options === null) options = {};

        const server = require("../server"),
            indexJs = require("..");
        /** @type {(...args: any[])=>Promise<import("../../types").createRequestReturnT>} */
        const requestJsOriginalExports = indexJs._getRequestJsOriginalExports();
        const cryptoJsExports = indexJs._getCryptoJsExports();

        if (options.crypto !== "weapi") {
            if (indexJs._isForceWeapi()) {
                log("强制 weapi", uri);
                options.crypto = "weapi";
            } else {
                log("未强制 weapi，转 NeteaseCloudMusicApi", uri);
                return resolve(requestJsOriginalExports(...arguments));
            }
        }
        if (!indexJs.server.getServerStatus()._wsConnection) {
            if (indexJs._isForceConnection()) {
                log("要求连接浏览器，但未连接，拒绝请求", uri);
                reject({
                    body: {
                        code: 502,
                        msg: "[NeteaseCloudMusicApi-hook] No Browser connected.",
                    },
                    cookie: [],
                    status: 502,
                });
            } else {
                log("要求连接浏览器，但未连接，转 NeteaseCloudMusicApi", uri);
                resolve(requestJsOriginalExports(...arguments));
            }
            return;
        }

        log("转浏览器", uri);
        const url = weapiDomain + "/weapi/" + uri.substring(5);
        server
            .createRequest({
                body: cryptoJsExports.weapi({ ...data, csrf_token: "" }),
                method: "POST",
                url,
            })
            .then(resolve)
            .catch(reject);
    });
}

module.exports = createRequest;
