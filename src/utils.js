// @ts-check
"use strict";

let debug = false;

/**
 * 输出日志
 * @param  {...*} args
 */
function log(...args) {
    console.log("" + new Date(), ...args);
}
/**
 * 控制日志输出
 * @param {Boolean | undefined | null} flag
 */
function setDebugMode(flag) {
    debug = flag ?? debug;
}

module.exports = { log, setDebugMode };
