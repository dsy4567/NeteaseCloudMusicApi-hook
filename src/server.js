// @ts-check
"use strict";

const WebSocketServer = require("websocket").server;
const http = require("http");
const { log } = require("./utils");
const fs = require("fs/promises");
const path = require("path");
const EventEmitter = require("events");

const closeTimeout = 30000;
const maxSize = 1024 * 1024 * 20;
/** @type {import("../types").ServerStatus} */
let serverStatus = {
    running: false,
    port: null,
    _httpServer: null,
    _wsServer: null,
    _wsConnection: null,
    jsUrl: "",
    wsUrl: "",
};

class LoginStatus extends EventEmitter {
    /**
     * @param {String} [MUSIC_U]
     * @param {String} [__csrf]
     */
    constructor(MUSIC_U = "qwq", __csrf = "awa") {
        super();
        this.MUSIC_U = MUSIC_U;
        this.__csrf = __csrf;
    }
}
/** @type {import("../types").LoginStatus} */
let loginStatus = new LoginStatus();
/** @type {Record<String,{resolve:(data:import("../types").createRequestReturnT)=>void,reject:(data:import("../types").createRequestReturnT)=>void}>} */
let requests = {};

/** @type {import("http").Server?} */
let httpServer = null;
/** @type {WebSocketServer?} */
let wsServer = null;
/** @type {String} */
let connectionToken = crypto.randomUUID();
const trustedHostnames = ["music.163.com", "localhost"];

/**
 * @param {String} origin
 */
function originIsAllowed(origin) {
    try {
        const U = new URL(origin);
        if (!trustedHostnames.includes(U.hostname)) {
            log("The origin is not ncm or localhost.", origin);
            return false;
        }
        return true;
    } catch (e) {
        console.error(e);
    }
    return false;
}
/**
 * @param {Number} port
 * @param {String} hostname
 */
function start(port = 16333, hostname = "localhost", cToken = "") {
    if (serverStatus.running) throw new Error("The server is already running");
    if (cToken) connectionToken = cToken;

    /**
     * @param {http.ServerResponse} response
     */
    function handleNotFound(response) {
        response.writeHead(404);
        response.end(null);
    }
    if (httpServer && wsServer) {
        httpServer.listen(port, hostname, function () {
            log(" Server is listening on port " + port);
        });
        wsServer.mount({
            httpServer,
            autoAcceptConnections: false,
            maxReceivedFrameSize: maxSize,
            maxReceivedMessageSize: maxSize,
        });
    } else {
        serverStatus._httpServer = httpServer = http.createServer(
            async (request, response) => {
                log(" Received request for " + request.url);

                try {
                    if (request.url) {
                        const U = new URL(
                            "http://" + (hostname ?? "localhost") + request.url
                        );
                        if (U.pathname !== "/inject.js")
                            return handleNotFound(response);

                        response.writeHead(200, {
                            "content-type": "text/javascript; charset=utf-8",
                        });
                        response.end(
                            await fs.readFile(
                                path.join(__dirname, "browser/inject.js")
                            )
                        );
                    } else handleNotFound(response);
                } catch (e) {
                    response.writeHead(500);
                    response.end(null);
                }
            }
        );
        httpServer.listen(port, hostname, function () {
            log(" Server is listening on port " + port);
        });
        httpServer.on("close", () => {
            log(" Server is closed");
        });

        serverStatus._wsServer = wsServer = new WebSocketServer({
            httpServer,
            autoAcceptConnections: false,
            maxReceivedFrameSize: maxSize,
            maxReceivedMessageSize: maxSize,
        });
        wsServer.on("request", function (request) {
            if (
                request.resourceURL.pathname !==
                new URL("ws://localhost/" + connectionToken).pathname
            ) {
                request.reject();
                return;
            }
            if (!originIsAllowed(request.origin)) {
                request.reject();
                log(" Connection from origin " + request.origin + " rejected.");
                return;
            }
            if (serverStatus._wsConnection) {
                request.reject();
                log("This already has a connection, rejected.");
                return;
            }

            function resetCloseTimer() {
                clearTimeout(closeTimer);
                closeTimer = setTimeout(() => {
                    connection.drop(3000);
                }, closeTimeout);
            }
            /** @returns {never} */
            function handleInvalid() {
                throw new Error("Invalid message.");
            }

            let connection = request.accept();
            serverStatus._wsConnection = connection;
            let closeTimer;
            let handshakeCompleted = false;
            resetCloseTimer();
            log(" Connection accepted.");
            connection.on("message", function (message) {
                /** @type {string | undefined | null} */
                let requestId;
                let errorReason = "Another reason.";
                try {
                    if (message.type === "utf8") {
                        /** @type {import("../types").WsMessage | null} */
                        const mFromBrowser = JSON.parse(message.utf8Data);
                        /** @type {import("../types").WsMessage | undefined} */
                        let mFromServer;
                        /** @type {(typeof requests)[string]} */
                        let request;
                        // @ts-ignore
                        requestId = mFromBrowser.requestId;

                        if (
                            mFromBrowser?.action !== "hello" &&
                            !handshakeCompleted
                        )
                            return connection.drop(3000);

                        switch (mFromBrowser?.action) {
                            case "hello":
                                resetCloseTimer();
                                mFromServer = {
                                    action: "hi",
                                    success: true,
                                };
                                handshakeCompleted = true;

                                break;
                            case "ping":
                                resetCloseTimer();
                                mFromServer = {
                                    action: "pong",
                                    success: true,
                                };
                                break;
                            case "loginStatusUpdated":
                                const __csrf = mFromBrowser.data?.__csrf,
                                    MUSIC_U = mFromBrowser.data?.MUSIC_U;
                                if (
                                    typeof __csrf === "string" &&
                                    typeof MUSIC_U === "string"
                                )
                                    updateLoginStatus(MUSIC_U, __csrf);

                                break;
                            case "e_invalidMessageFromServer":
                                if (requestId) {
                                    request = requests[requestId];
                                    if (request)
                                        request.reject({
                                            status: 502,
                                            body: {
                                                code: 502,
                                                msg:
                                                    "[NeteaseCloudMusicApi-hook] " +
                                                    mFromBrowser.body,
                                            },
                                            cookie: [],
                                        });
                                }
                                break;
                            case "response":
                                if (!requestId) {
                                    errorReason = "Invalid requestId.";
                                    handleInvalid();
                                }
                                request = requests[requestId];
                                if (!request) {
                                    errorReason = "Request not found.";
                                    handleInvalid();
                                }
                                const response = mFromBrowser.data;
                                if (mFromBrowser.success)
                                    request.resolve(response.data);
                                else request.reject(response.data);
                                delete requests[requestId];
                                break;
                            case "readyClose":
                                connection.close(1000);
                                return;

                            default:
                                handleInvalid();
                        }
                        mFromServer &&
                            connection.sendUTF(JSON.stringify(mFromServer));
                    } else if (message.type === "binary") {
                        handleInvalid();
                    }
                } catch (e) {
                    /** @type {import("../types").WsMessage} */
                    const m = {
                        action: "e_invalidMessageFromBrowser",
                        body: errorReason,
                        success: false,
                        requestId,
                    };
                    connection.sendUTF(JSON.stringify(m));
                    console.error(e, message, errorReason);
                }
            });
            connection.on("close", function (reasonCode, description) {
                clearTimeout(closeTimer);
                log(
                    " Peer " + connection.remoteAddress + " disconnected.",
                    reasonCode,
                    description
                );
                serverStatus._wsConnection = null;
                clearLoginStatus();
            });
        });
    }

    const U = new URL(
        `http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port}/`
    );
    U.pathname = "/inject.js";
    serverStatus.jsUrl = "" + U;
    U.pathname = "/" + connectionToken;
    U.protocol = "ws";
    serverStatus.wsUrl = "" + U;
    serverStatus.running = true;
    serverStatus.port = port;
    return serverStatus;
}
/**
 * @returns {Promise<void>}
 */
function stop() {
    return new Promise((resolve, reject) => {
        const f = () => {
            serverStatus._wsServer?.shutDown();
            httpServer?.close(err => {
                if (err) return console.error(err);
            });
            serverStatus.jsUrl = "";
            serverStatus.wsUrl = "";
            serverStatus.running = false;
            serverStatus.port = null;
            resolve();
        };

        if (serverStatus._wsConnection) {
            serverStatus._wsConnection.on("close", f);
            serverStatus._wsConnection.close(1000);
        } else f();
        log("Server is stopping.");
    });
}
function getStatus() {
    return serverStatus;
}
/**
 * @param {import("../types").RequestData} data
 * @returns {Promise<import("../types").createRequestReturnT>}
 */
async function createRequest(data) {
    return new Promise((resolve, reject) => {
        const connection = serverStatus._wsConnection;
        if (!connection) {
            /** @type {import("../types").createRequestReturnT} */
            const responseData = {
                body: {
                    code: 502,
                    msg: "[NeteaseCloudMusicApi-hook] No Browser connected.",
                },
                cookie: [],
                status: 502,
            };
            return reject(responseData);
        }
        const requestId = crypto.randomUUID();
        /** @type {import("../types").WsMessage} */
        const mFromServer = {
            action: "request",
            data,
            requestId,
        };
        connection.sendUTF(JSON.stringify(mFromServer));
        requests[requestId] = {
            resolve,
            reject,
        };
    });
}
/**
 * @returns {LoginStatus}
 */
function clearLoginStatus(_emitEvent = true) {
    loginStatus.MUSIC_U = "";
    loginStatus.__csrf = "";
    _emitEvent && loginStatus.emit("update", loginStatus);
    return loginStatus;
}
/**
 * @param {String} MUSIC_U
 * @param {String} __csrf
 */
function updateLoginStatus(MUSIC_U = "", __csrf = "") {
    loginStatus.MUSIC_U = MUSIC_U;
    loginStatus.__csrf = __csrf;
    loginStatus.emit("update", loginStatus);
    return loginStatus;
}

/** @type {import("../types").RequestData} */
let requestData;
const additionalApis = {
    /**
     * @param {number} id
     */
    async getMusicUrl(id) {
        requestData = { url: "getMusicUrl", body: { id }, method: "GET" };
        return createRequest(requestData);
    },
    async logout() {
        requestData = { url: "logout", body: {}, method: "POST" };
        return createRequest(requestData);
    },
};

module.exports = {
    start,
    stop,
    getStatus,
    loginStatus: {
        get: () => loginStatus,
        clear: clearLoginStatus,
    },
    additionalApis,
    createRequest,
};
