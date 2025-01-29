import EventEmitter from "events";

export interface InitConfig {
    /** NeteaseCloudMusicApi/main.js 的绝对路径，可通过 require.resolve("NeteaseCloudMusicApi") 获取 */
    pathToJs?: string;
    /** 强制使用 weapi，默认 false */
    forceWeapi?: boolean;
    /** 强制要求连接浏览器，默认 false */
    forceConnection?: boolean;
    /** 服务器监听端口，默认 16333 */
    serverPort?: number;
    /** 服务器监听 ip/hostname，默认 localhost */
    serverHost?: string;
    /** 替换 "ws://\<hostname\>:\<port\>/\<随机 UUID\>" 的 \<随机 UUID\> */
    connectionToken?: string;
    /** 是否输出日志 */
    debug?: boolean;
}
export interface ServerStatus {
    /** 服务器是否正在运行 */
    running: boolean;
    /** 服务器正在监听的端口 */
    port: number?;
    _httpServer: import("http").Server?;
    _wsServer: import("websocket").server?;
    _wsConnection: import("websocket").connection?;
    /**
     * JavaScript 文件地址，如果初始化时指定了奇奇怪怪的 hostname/ip，请自行更正 \<hostname\>
     *
     * 一般是 "http://\<hostname\>:\<port\>/inject.js"，保证 \<hostname\>:\<port\> 与 wsUrl 相同
     */
    jsUrl: string;
    /**
     * WebSocket 地址，如果初始化时指定了奇奇怪怪的 hostname/ip，请自行更正 \<hostname\>
     *
     * 一般是 "ws://\<hostname\>:\<port\>/\<随机 UUID\>"，保证 \<hostname\>:\<port\> 与 jsUrl 相同
     */
    wsUrl: string;
}
export interface InitReturnT {
    exports: any;
    serverStatus: ServerStatus;
}
export class LoginStatus extends EventEmitter {
    MUSIC_U: string;
    __csrf: string;
    constructor(MUSIC_U: string = "", __csrf: string = "");
    /** 用户信息变更/首次获取用户信息时触发（浏览器端依靠检测 cookie MUSIC_U 变化判断） */
    on(event: "update", cb: (loginStatus: LoginStatus) => void): this;
    /** 用户信息变更/首次获取用户信息时触发（浏览器端依靠检测 cookie MUSIC_U 变化判断） */
    addListener(event: "update", cb: (loginStatus: LoginStatus) => void): this;
}
export interface createRequestReturnT {
    status: number;
    body: any;
    cookie: never[];
}
export type RequestData = {
    method: string;
    url: string;
    body: any;
};
/** WebSocket 消息可用的 actions */
export type WsMessageActions =
    | "readyClose" // 任意一方请求关闭连接
    // from server
    | "hi" // 服务端与浏览器完成握手
    | "pong" // 服务端回应浏览器心跳
    | "request" // 服务端要求浏览器向网易云发送指定请求
    | "e_invalidUid" // 首次建立 ws 连接后提供的 uid 不合法
    | "e_invalidMessageFromBrowser" // 浏览器发送的 message 无效，服务端处理相关 request（如有 requestId）
    // from browser
    | "hello" // 浏览器请求握手并设置用户信息，或仅重置用户信息
    | "ping" // 浏览器发送心跳包
    | "response" // 浏览器回应要求发送的请求
    | "loginStatusUpdated" // 浏览器检测到用户信息变更
    | "e_invalidMessageFromServer"; // 服务端发送的 message 无效，服务端处理相关 request（如有 requestId）
/** WebSocket 消息 */
export type WsMessage =
    | {
          action: "hello";
      }
    | {
          action: "hi";
          success: boolean;
      }
    | {
          action: "ping";
      }
    | {
          action: "pong";
          success: boolean;
      }
    | {
          action: "request";
          data: RequestData;
          requestId: string;
      }
    | {
          action: "response";
          data: {
              httpStatus: number | null;
              data: {
                  status: number;
                  body: any;
                  cookie: never[];
              };
          };
          requestId: string;
          success: boolean;
      }
    | {
          action: "loginStatusUpdated";
          data: { __csrf: string; MUSIC_U: string };
      }
    | {
          action: "readyClose";
      }
    | {
          action: "e_invalidMessageFromBrowser" | "e_invalidMessageFromServer";
          body: string;
          requestId?: string?;
          success: false;
      }
    | {
          action: "e_invalidUid";
          requestId?: string?;
          success: false;
      };
export type AdditionalApiUrls = "logout";

/** require & hook，并启动服务器 */
export function init(config?: InitConfig): import("../types").InitReturnT;
/** 控制是否输出日志 */
export function setDebugMode(): void;
/** 返回结果大约等同与 `require("NeteaseCloudMusicApi")` */
export function getExports(): any;
/** 恢复对 NeteaseCloudMusicApi/util/request.js 的 hook */
export function hook(): boolean;
/** 暂停对 NeteaseCloudMusicApi/util/request.js 的 hook */
export function unhook(): boolean;
export const server: {
    /** 获取服务器状态 */
    getServerStatus(): ServerStatus;
    /** 启动服务器 */
    start(port?: number, hostname?: string): ServerStatus;
    /** 关闭服务器 */
    stop(): Promise<void>;
    /** 获取服务器状态 */
    getServerStatus(): ServerStatus;
    /** 操控浏览器发出请求 */
    _createRequest(
        data: RequestData
    ): Promise<import("../types").createRequestReturnT>;
};
export const loginStatus: {
    /** 获取已登录用户信息：MUSIC_U、__csrf */
    get: () => LoginStatus;
    /** 暂时清除服务端的用户信息，不会退出登录 */
    clear(): LoginStatus;
};
/** 一些额外的 api */
export const additionalApis: {
    /**
     * 操控浏览器退出登录
     */
    logout():
        | {
              status: 200;
              body: {};
              cookie: never[];
          }
        | {
              status: 500;
              body: {};
              cookie: never[];
          };
};
/** 获取 NeteaseCloudMusicApi/util/request.js 的原始导出 */
export function _getRequestJsOriginalExports(): any | undefined;
/** 获取 NeteaseCloudMusicApi/util/crypto.js 的导出 */
export function _getCryptoJsExports(): any | undefined;
/** 获取是否强制使用 weapi */
export function _isForceWeapi(): boolean;
/** 获取是否强制要求连接浏览器 */
export function _isForceConnection(): boolean;
