# NeteaseCloudMusicApi-hook

让 [NeteaseCloudMusicApi](https://gitlab.com/Binaryify/neteasecloudmusicapi) 用根正苗红的浏览器请求网易云音乐的 weapi 接口。

本项目基于 NeteaseCloudMusicApi 4.25.0 编写


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
- **只能本地使用**，不建议（也很难）在线部署（可以在线应用调本地接口~~或者够胆不嫌我代码写的烂/服务器压力大的话，在服务器上跑无头浏览器（bushi~~。


## 安装&快速上手

```bash
git clone https://gitlab.com/Binaryify/neteasecloudmusicapi NeteaseCloudMusicApi
git clone https://github.com/dsy4567/NeteaseCloudMusicApi-hook NeteaseCloudMusicApi-hook

cd NeteaseCloudMusicApi
npm i
cd ../NeteaseCloudMusicApi-hook
npm i
```

然后，阅读、运行、修改并测试示例代码 [example.js](./example.js)。



## 迁移

尽管本项目尽力减少与 NeteaseCloudMusicApi 的行为差异，迁移到 NeteaseCloudMusicApi-hook 仍需要注意以下几点：

- 你的项目**不能**连同本项目**在线部署**，也**不建议**尝试将本项目和 NeteaseCloudMusicApi 的服务**公开至公网**；
- 你需要**自行引导用户**在浏览器上登录网易云，并在控制台**执行特定代码**；
- 本项目**不支持**所有**非 weapi 接口**，直接调用它们时，将自动转到原 NeteaseCloudMusicApi（可在 `init()` 指定 `forceConnection` 来禁用非 weapi 接口，或调用 api 时指定参数 `{ crypto： "weapi" }` ）；
- 未连接浏览器时，调用任何 api 亦会走原 NeteaseCloudMusicApi（）
- 已连接到浏览器（尤其浏览器端已登录时），调用 weapi 不必带上 cookie（即使带上也会忽略）。
