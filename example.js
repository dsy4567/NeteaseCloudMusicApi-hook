// 以前 const ncmApi = require(...) 括号里是什么，ncmApiPkgName 的值就是什么
// 这里使用自己 clone 下来的 NeteaseCloudMusicApi，而不是 npm install 的
const ncmApiPkgName = "../NeteaseCloudMusicApi";

const ncmApiHook = require(".");
ncmApiHook.init({
    // 输出调试信息，默认 false
    debug: true,
    // NeteaseCloudMusicApi/main.js 的绝对路径，可通过 require.resolve("NeteaseCloudMusicApi") 获取
    pathToJs: require.resolve(ncmApiPkgName),
    // 是否强制使用 weapi，默认 false
    forceWeapi: true,
    // 是否强制要求连接浏览器，默认 false
    forceConnection: true,
    // 注意：指定奇奇怪怪的 hostname/ip 后，请注意更正 wsUrl/jsUrl 里的 <hostname>，非常不建议公开至公网
    serverHost: "localhost",
    // 服务器监听端口，默认 16333
    serverPort: 16333,
    // 替换 wsUrl "ws://<hostname>:<port>/<随机 UUID>" 的 <随机 UUID>
    connectionToken: "%E8%BF%99%E9%87%8C%E6%B2%A1%E6%9C%89%E5%BD%A9%E8%9B%8B",
});
// wsUrl、jsUrl 说明见底部

// 相当于 const ncmApi = require("NeteaseCloudMusicApi")
/** @type {import('../NeteaseCloudMusicApi')} */
const ncmApi = ncmApiHook.getExports();

let loginStatus = {},
    // 检测是否连接到浏览器
    connectingToBrowser = !!ncmApiHook.server.getServerStatus()._wsConnection;

ncmApiHook.loginStatus.get().on("update", ls => {
    // update 事件在 用户信息更新/浏览器建立连接后提供用户信息/浏览器断连后清空用户信息
    // 后触发，记得判断是否仍与浏览器保持连接
    connectingToBrowser = !!ncmApiHook.server.getServerStatus()._wsConnection;
    loginStatus = ls;
    console.log(
        "cookie MUSIC_U",
        loginStatus.MUSIC_U,
        "__csrf",
        loginStatus.__csrf
    );

    if (connectingToBrowser) {
        console.log("用户信息更新/浏览器建立连接后提供用户信息");
    } else {
        console.log("浏览器断连后清空用户信息");
    }
});
ncmApiHook.loginStatus.get().once("update", ls => {
    if (connectingToBrowser) {
        console.log("用户是否已登录", !!loginStatus.MUSIC_U);

        // 已经连接到浏览器时，调用 weapi 走浏览器
        ncmApi
            .user_account({ crypto: "weapi" })
            .then(res => {
                console.log("已经连接到浏览器 user_account（weapi）", res.body);
            })
            .catch(e => {
                console.error("已经连接到浏览器 user_account（weapi）", e);
            });
        // 注意非 weapi 始终不走浏览器（见常见问题 > 如何判断请求走浏览器还是 NeteaseCloudMusicApi）
        ncmApi
            .user_account({ crypto: "eapi" })
            .then(res => {
                console.log("已经连接到浏览器 user_account（eapi）", res.body);
            })
            .catch(e => {
                console.error("已经连接到浏览器 user_account（eapi）", e);
            });
        // 大数据，WebSocket 服务器测压
        ncmApi
            .playlist_track_all({
                id: 5144274490,
                limit: 1000,
                crypto: "weapi",
            })
            .then(res => {
                console.log(
                    "已经连接到浏览器 playlist_track_all（weapi）"
                    // res.body
                );
            })
            .catch(e => {
                console.error(
                    "已经连接到浏览器 playlist_track_all（weapi）",
                    e
                );
            });

        setTimeout(() => {
            ncmApiHook.unhook();

            // unhook 后，调用任何 api 走原版 NeteaseCloudMusicApi
            ncmApi
                .user_account({ crypto: "weapi" })
                .then(res => {
                    console.log("unhook 后 user_account（weapi）", res.body);
                })
                .catch(e => {
                    console.error("unhook 后 user_account（weapi）", e);
                });
            ncmApi
                .user_account({ crypto: "eapi" })
                .then(res => {
                    console.log("unhook 后 user_account（eapi）", res.body);
                })
                .catch(e => {
                    console.error("unhook 后 user_account（eapi）", e);
                });
        }, 10000);
    }
});

// 未连接浏览器时，调用任何 api 走原版 NeteaseCloudMusicApi
// 此时显然为未登录状态（除非指定 cookie）
if (!connectingToBrowser) {
    ncmApi
        .user_account({ crypto: "weapi" })
        .then(res => {
            console.log("未连接浏览器 user_account（weapi）", res.body);
        })
        .catch(e => {
            console.error("未连接浏览器 user_account（weapi）", e);
        });

    // 注意非 weapi 始终不走浏览器（除非指定了 forceWeapi）
    ncmApi
        .user_account({ crypto: "eapi" })
        .then(res => {
            console.log("未连接浏览器 user_account（eapi）", res.body);
        })
        .catch(e => {
            console.error("未连接浏览器 user_account（eapi）", e);
        });
}

// 引导用户
// jsUrl 一般是 "http://<hostname>:<port>/inject.js"，保证 <hostname>:<port> 与 wsUrl 相同
// wsUrl 一般是 "ws://<hostname>:<port>/<随机 UUID>"，保证 <hostname>:<port> 与 jsUrl 相同
setTimeout(() => {
    console.log(`
//******************************//

请使用浏览器打开 https://music.163.com 并登录你的网易云帐号，
然后打开开发者工具（F12 / Ctrl + Shift + I），在控制台（Console）输入以下代码:

(() => {
    let s = document.createElement("script");
    s.dataset.connectionToken = "${ncmApiHook.server
        .getServerStatus()
        .wsUrl.split("/")
        .at(-1)}";
    s.src = "${ncmApiHook.server.getServerStatus().jsUrl}";
    document.head.append(s);
})();

//******************************//
`);
}, 5000);
