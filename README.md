# NeteaseCloudMusicApi-hook

让 [NeteaseCloudMusicApi](https://gitlab.com/Binaryify/neteasecloudmusicapi) 用根正苗红的浏览器请求网易云音乐的 weapi 接口。

本项目基于 NeteaseCloudMusicApi 4.25.0 编写。


## 原理&优缺点

本项目通过使用类似于临时替换 [util/request.js](https://gitlab.com/Binaryify/neteasecloudmusicapi/-/blob/main/util/request.js) 的方式来拦截请求，
并**将请求转交给**事先要求用户**在浏览器内运行的**，特别编写的**JS**。发起请求的一般大致流程如下：

```
hook 前

你的项目
  |^
  ||
  v|
NeteaseCloudMusicApi
  |^
  ||https
  v|
music.163.com
```

```
hook 后

（你已引导用户在浏览器上登录网易云，并在控制台执行特定代码）

你的项目
  |^
  ||
  v|
NeteaseCloudMusicApi
  |^
  ||
  v|
NeteaseCloudMusicApi-hook
  |^
  ||
  v|
local server
  |^
  ||WebSocket
  v|
browser
  |^
  ||https
  v|
music.163.com
```

这样做的好处是，请求在浏览器发出，可以**绕过多数风控手段**（过环境检测、允许用户手动解决人机验证等），也不必费尽心思模拟浏览器的行为。

但缺点也很明显：
- ~~肯定有人认为本项目在画蛇添足~~；
- 部分返回结果**有异于**原 NeteaseCloudMusicApi（如返回结果里的 `cookie[]` 数组始终为空）；
- 每次运行都需要引导用户在控制台执行特定代码，**麻烦且增加了**现有应用的**使用门槛**（可以指定固定的 `connectionToken` + 油猴脚本/折腾无头浏览器来解决）；
- **只能本地使用**，不建议（也很难）在线部署（可以在线应用调访客设备上部署的接口）。


## 安装&快速上手

```bash
git clone https://gitlab.com/Binaryify/neteasecloudmusicapi NeteaseCloudMusicApi
git clone https://github.com/dsy4567/NeteaseCloudMusicApi-hook NeteaseCloudMusicApi-hook

cd NeteaseCloudMusicApi
npm i
cd ../NeteaseCloudMusicApi-hook
npm i
```

一般用法请参见示例代码 [example.js](./example.js)。

更多详细用法请见 [types/index.d.ts](types/index.d.ts)。


## 迁移

> **定义**：如无特别说明，
>
> `ncmApiHook` 即 `require("./path/to/NeteaseCloudMusicApi-hook")`；
>
> `ncmApi` 即 `require('NeteaseCloudMusicApi')` 或 `ncmApiHook.getExports()`。

对于一些项目，只需要改变登录逻辑即可，甚至只需要加几行代码就行；对于另一些项目，则可能需要不同程度的大改。

尽管本项目尽力减少与 NeteaseCloudMusicApi 的行为差异，迁移到 NeteaseCloudMusicApi-hook 仍需要注意以下几点：

- 本项目设计之初是供**本地应用**（而不是在线应用）使用，你的项目**不能**连同本项目**在线部署**，也**不要**尝试将本项目的服务**公开至公网**；
- 注意默认情况下，本项目会**自行决定请求去向**，详见“常见问题 > 如何判断请求走浏览器还是 NeteaseCloudMusicApi”；
- 你需要**自行引导用户**在浏览器上登录网易云，并在控制台**执行特定代码**；
- 本项目**不支持**所有**非 weapi 接口**，直接调用它们时，将自动转到原 NeteaseCloudMusicApi（见 常见问题 ）；
- 未连接浏览器时，调用任何 api 亦会走原 NeteaseCloudMusicApi（除非在 `ncmApiHook.init()` 指定 `{ forceConnection: true }`，未连接浏览器将拒绝所有请求 ）；
- 如果请求将要走浏览器（尤其浏览器端已登录时），调用 weapi 不必带上 cookie（即使带上也会忽略）。


## 常见问题

### 如何在线部署？

- ~~在**访客**的设备上部署用到本项目的简易服务，然后让你的在线应用访问**访客设备上的服务**~~；
- 放弃这个想法。


### 如何登录？

请求走浏览器，需提前引导用户在浏览器打开 [music.163.com](https://music.163.com/) 并正常完成登录流程，然后在控制台执行以下代码，无需在 `ncmApi.foo_bar()` 指定 `{ cookie: "MUSIC_U=xxx;" }`（即使指定也会忽略）；

```js
// 详见 example.js

(() => {
    let s = document.createElement("script");
    s.dataset.connectionToken = "REPLACE_THIS"
    s.src = "REPLACE_THIS";
    document.head.append(s);
})();
```

请求走 NeteaseCloudMusicApi，在 `ncmApi.foo_bar()` 指定 `{ cookie: "MUSIC_U=xxx;" }` 即可。

如需获取浏览器内部分 cookies，使用 `ncmApiHook.loginStatus.get()` 即可。


### 如何强制使用 weapi 加密接口？

以下方法任选其一：

- 在 `ncmApiHook.init()` 指定 `{ forceWeapi: true }` 来禁用非 weapi 接口；
  ```js
  ncmApiHook.init({ forceWeapi: true });
  ```
- 调用 api 时，像原来那样指定 `{ crypto: "weapi" }` ）；
  ```js
  ncmApi.like({ id: 114514, like: true, crypto: "weapi" });
  ```


### 如何判断请求走浏览器还是 NeteaseCloudMusicApi?

**实际情况请以在 `ncmApiHook.init()` 指定 `{ debug: true }` 后的日志为准。**

满足和以下条件之一，任何请求必定**走浏览器或被拒绝**：

- 在 `ncmApiHook.init()` 指定了 `{ forceWeapi: true, forceConnection: true }`；
- 在表达式 `!!ncmApiHook.server.getServerStatus()._wsConnection === true` 和以下条件之一成立时。
  - 在 `ncmApiHook.init()` 指定了 `{ forceWeapi: true }`；
  - 在 `ncmApi.foo_bar()` 指定了 `{ crypto: "weapi" }`；
  - 其他最终会请求 weapi 的情况。

满足以下条件之一，任何请求必定**走 NeteaseCloudMusicApi 或被拒绝**：

- 调用了 `ncmApiHook.unhook()`，随后从未调用 `ncmApiHook.hook()`；
- 在表达式 `!!ncmApiHook.server.getServerStatus()._wsConnection === false` 和以下条件之一成立时；
  - 在 `ncmApiHook.init()` 指定了 `{ forceConnection: false }`（默认值）。
- 表达式 `!!ncmApiHook.server.getServerStatus()._wsConnection === true` 成立，且在 `ncmApiHook.init()` 指定了 `{ forceWeapi: false }`（默认值），且以下条件之一成立时。
  - 在 `ncmApi.foo_bar()` 指定了 `{ crypto: "eapi" | "api" | "linuxapi" }`；
- 其他最终会请求**非** weapi 的情况。


### 每次都要要求用户在控制台执行代码太麻烦，有没有更方便的方法？

1. 在 `ncmApiHook.init()` 指定 `{ connectionToken: "<固定值>" }`；
2. 适当修改 [src/browser/inject.js](./src/browser/inject.js)，并将其以油猴脚本的形式提供给用户。

### 是否支持多用户？

请求走浏览器时，除非不断更换连接的浏览器（同一 NeteaseCloudMusicApi-hook 实例同一时间只能接受一个连接），或者合理使用 `ncmApiHook.unhook()`，否则一个实例**只支持一名用户**；

请求走 NeteaseCloudMusicApi 时，取决于你的应用是否支持多用户。


### 浏览器与 NeteaseCloudMusicApi-hook 的服务器意外断连怎么办？

在浏览器端打开开发者工具，并筛选 `[NeteaseCloudMusicApi-hook]`。

如果找到“非正常断连，x 秒后重试”的日志，可等待重连；

如果找到“重连次数过多”的日志，请尝试重启你的应用或检查网络连接（局域网）；

如果以上操作没有效果，请准备好你应用的日志、浏览器控制台的日志，以及浏览器开发者工具 > “网络”选项卡 > 与本项目相关的 WebSocket 连接的**所有脱敏消息**，然后提交 issue。


### 本项目和 NeteaseCloudMusicApi 有哪些返回结果上的差异？

已知明显差异如下：

- 执行 `ncmApi.foo_bar()` 后返回的结果中，`cookie[]` 数组始终为空；
- 返回结果中的状态码，少数情况下可能不同于 NeteaseCloudMusicApi（如你认为有必要，可提交 issue 讨论）。
