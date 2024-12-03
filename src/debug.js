const debug = require("debug")("mitm:unknown");

/**
 * http-mitm-proxy is calling console.debug. That's just an alias to console.log
 * We want to suppress these debug logs unless we're actually debugging.
 * Log all console.debug calls as from an unknown location using debug
 * @param  {...any} args
 */
console.debug = function (...args) {
	debug(...args);
};
