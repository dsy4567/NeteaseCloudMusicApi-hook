// @ts-nocheck

(() => {
    "use strict";

    const trustedHostnames = ["music.163.com", "interface.music.163.com"],
        closeTimeout = 30000,
        pingInterval = 15000;

    /**
     * @param {'log' | 'error'} type
     * @param  {...any} args
     */
    function con(type, ...args) {
        // @ts-ignore
        console.log("[NeteaseCloudMusicApi-hook]", `[${type}]`, ...args);
    }
    function getWsUrl() {
        try {
            // @ts-ignore
            const U = new URL(document.currentScript.src);
            U.protocol = "ws";
            // @ts-ignore
            U.pathname = "/" + document.currentScript.dataset.connectionToken;
            return "" + U;
        } catch (e) {
            return "";
        }
    }
    /**
     * @param {"MUSIC_U" | "__csrf"} key
     */
    function getCookie(key) {
        return document.cookie.replace(
            key === "MUSIC_U"
                ? /(?:(?:^|.*;\s*)MUSIC_U\s*\=\s*([^;]*).*$)|^.*$/
                : /(?:(?:^|.*;\s*)__csrf\s*\=\s*([^;]*).*$)|^.*$/,
            "$1"
        );
    }
    function updateLoginStatus() {
        const tempCsrfToken = getCookie("__csrf"),
            tempCookie_MUSIC_U = getCookie("MUSIC_U");
        if (
            tempCsrfToken !== loginStatus.__csrf ||
            tempCookie_MUSIC_U !== loginStatus.MUSIC_U
        ) {
            loginStatus.__csrf = tempCsrfToken;
            loginStatus.MUSIC_U = tempCookie_MUSIC_U;
            sendWsMessage({
                action: "loginStatusUpdated",
                data: { __csrf: tempCsrfToken, MUSIC_U: tempCookie_MUSIC_U },
            });
        }
    }
    /**
     * @param {import("../../types").WsMessage} mFromBrowser
     */
    function sendWsMessage(mFromBrowser) {
        currentWsConnection?.send(JSON.stringify(mFromBrowser));
    }
    function handleInvalid(requestId = null, errorReason = "Another reason.") {
        sendWsMessage({
            action: "e_invalidMessageFromServer",
            body: errorReason,
            success: false,
            requestId,
        });
    }
    function disconnect(code = 1000, setUnexpectedDisconnectionTo = false) {
        unexpectedDisconnection = setUnexpectedDisconnectionTo;
        currentWsConnection?.close(code);
    }

    function wsConnect() {
        if (currentWsConnection) return con("error", "已有 WebSocket 连接");
        function resetCloseTimer() {
            clearTimeout(closeTimer);
            closeTimer = setTimeout(() => {
                disconnect(3000);
            }, closeTimeout);
        }
        function setPingTimer() {
            clearInterval(pingTimer);
            pingTimer = setInterval(() => {
                sendWsMessage({ action: "ping" });
            }, pingInterval);
        }

        let handshakeCompleted = false;
        let closeTimer, pingTimer;
        resetCloseTimer();
        setPingTimer();

        currentWsConnection = new WebSocket(wsUrl);
        // @ts-ignore
        currentWsConnection.addEventListener("open", ev => {
            sendWsMessage({ action: "hello" });
        });
        currentWsConnection.addEventListener("message", async ev => {
            let requestId = null;
            try {
                /** @type {import("../../types").WsMessage} */
                const mFromServer = JSON.parse("" + ev.data);
                // @ts-ignore
                requestId = mFromServer.requestId;

                if (mFromServer.action !== "hi" && !handshakeCompleted)
                    return disconnect(3000);

                switch (mFromServer.action) {
                    case "hi":
                        if (!mFromServer.success) return disconnect();
                        handshakeCompleted = true;
                        reconnectCount = 0;
                        updateLoginStatus();
                        break;
                    case "e_invalidMessageFromBrowser":
                        if (!handshakeCompleted)
                            currentWsConnection?.close(3000);
                        break;
                    case "pong":
                        updateLoginStatus();
                        resetCloseTimer();
                        break;
                    case "readyClose":
                        disconnect(1000);
                        break;
                    case "request":
                        if (!requestId || !mFromServer?.data)
                            return handleInvalid(
                                requestId,
                                "Invalid request or data."
                            );
                        /** @type {URL | undefined} */
                        let U;
                        try {
                            U = new URL(mFromServer.data.url);
                            if (!trustedHostnames.includes(U.hostname)) throw 0;
                        } catch (e) {
                            /** @type {import("../../types").AdditionalApiUrls | undefined } */
                            // @ts-ignore
                            const additionalApiUrl = mFromServer?.data?.url;
                            switch (additionalApiUrl) {
                                case "logout":
                                    const elem = document.querySelector(
                                        "#auto-id-WnLiO9wK1trUAEiP > div.m-tlist.m-tlist-lged.j-uflag > ul.f-cb.lt > li > a"
                                    );
                                    if (!elem) {
                                        sendWsMessage({
                                            action: "response",
                                            requestId,
                                            data: {
                                                data: {
                                                    status: 500,
                                                    body: {},
                                                    cookie: [],
                                                },
                                                httpStatus: null,
                                            },
                                            success: false,
                                        });
                                        break;
                                    }
                                    elem
                                        // @ts-ignore
                                        .click();
                                    sendWsMessage({
                                        action: "response",
                                        requestId,
                                        data: {
                                            data: {
                                                status: 200,
                                                body: {},
                                                cookie: [],
                                            },
                                            httpStatus: null,
                                        },
                                        success: true,
                                    });
                                    break;

                                default:
                                    return handleInvalid(
                                        requestId,
                                        "Untrusted hostname or invalid URL." +
                                            (U || "")
                                    );
                            }
                            return updateLoginStatus();
                        }

                        try {
                            U.searchParams.set(
                                "csrf_token",
                                loginStatus.__csrf
                            );
                            const method =
                                mFromServer.data.method.toUpperCase();

                            const res = await fetch(U, {
                                body: ["GET", "HEAD"].includes(method)
                                    ? undefined
                                    : new URLSearchParams(
                                          mFromServer.data.body
                                      ).toString(),
                                method,
                                cache: "no-cache",
                                headers: {
                                    "content-type":
                                        "application/x-www-form-urlencoded",
                                },
                                mode: "cors",
                            });
                            let body = await res.text();
                            let answer = { status: 500, body: {}, cookie: [] };
                            try {
                                body = JSON.parse(body);
                                answer.body = body;
                                if (answer.body.code) {
                                    answer.body.code = +answer.body.code;
                                }
                                answer.status = +(
                                    answer.body.code || res.status
                                );
                                if (
                                    answer.body.code in
                                    [201, 302, 400, 502, 800, 801, 802, 803]
                                ) {
                                    // 特殊状态码
                                    answer.status = 200;
                                }
                            } catch (e) {
                                answer.body = body;
                                answer.status = res.status;
                            }

                            answer.status =
                                100 < answer.status && answer.status < 600
                                    ? answer.status
                                    : 400;

                            let success = answer.status === 200;

                            sendWsMessage({
                                action: "response",
                                data: { data: answer, httpStatus: res.status },
                                requestId: mFromServer.requestId,
                                success,
                            });
                        } catch (e) {
                            sendWsMessage({
                                action: "response",
                                data: {
                                    data: {
                                        status: 502,
                                        body: {
                                            code: 502,
                                            msg: "[NeteaseCloudMusicApi-hook] Failed to fetch.",
                                        },
                                        cookie: [],
                                    },
                                    httpStatus: null,
                                },
                                requestId: mFromServer.requestId,
                                success: false,
                            });
                        }
                        updateLoginStatus();
                        break;

                    default:
                        break;
                }
            } catch (e) {
                handleInvalid(requestId);
            }
        });
        currentWsConnection.addEventListener("close", ev => {
            clearTimeout(closeTimer);
            clearInterval(pingTimer);
            currentWsConnection = null;
            if (ev.code !== 1000 && unexpectedDisconnection) {
                if (++reconnectCount > 3) return con("error", "重连次数过多");
                con("error", "非正常断连，10 秒后重试");
                setTimeout(() => {
                    wsConnect();
                }, 10000);
            }
            unexpectedDisconnection = true;
            con("log", "已断开连接", ev);
        });
        currentWsConnection.addEventListener("error", ev => {
            con("error", "WebSocket 错误", ev);
        });
    }

    if (location.host !== "music.163.com")
        return con("error", "hostname 不是 music.163.com");
    if (!document.currentScript)
        return con("error", "请以 <script> 标签形式执行脚本");
    if (!document.currentScript.dataset.connectionToken)
        return con("error", "<script> 标签未指定 data-connect-token 属性");

    const wsUrl = getWsUrl();
    if (!wsUrl) return con("error", "无法获取 WebSocket 地址");
    con("log", "请在浏览器询问框确认操作");
    if (
        !confirm(`警告：即将连接到 ${wsUrl}，请确认是否继续？
如果你 *不知道自己在做什么*，或 *不信任* 让你做这件事的程序/人，请点击“取消”，
让你做这件事的程序/人将能够 *代表你*，使用你的网易云帐号 *执行几乎任何操作*，请慎重考虑！`)
    ) {
        return con("error", "用户拒绝操作");
    }

    /** @type {WebSocket | null} */
    let currentWsConnection = null;
    let reconnectCount = 0;
    let unexpectedDisconnection = true;
    let loginStatus = {
        MUSIC_U: "qwq",
        __csrf: "awa",
    };

    wsConnect();
})();
