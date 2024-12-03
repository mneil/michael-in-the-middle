require("./debug");
const debug = require("debug")("mitm:proxy");
const { Proxy } = require("http-mitm-proxy");
const { BodyRecorder } = require("./recorder");
const aws = require("./provider/aws");

function create() {
	const proxy = new Proxy();

	proxy.onError(function (ctx, err) {
		console.error("proxy error:", err);
	});

	proxy.onResponse(
		/**
		 * @type {import('http-mitm-proxy/types').OnRequestParams}
		 */
		(ctx, next) => {
			debug("onResponse");
			next();
		},
	);
	proxy.onResponseHeaders(
		/**
		 * @type {import('http-mitm-proxy/types').OnRequestParams}
		 */
		(ctx, next) => {
			debug("onResponseHeaders:proxyToClientResponse", ctx.proxyToClientResponse.headers);
			debug("onResponseHeaders:serverToProxyResponse", ctx.serverToProxyResponse.headers);
			next();
		},
	);
	proxy.onResponseData(
		/**
		 * @type {import('http-mitm-proxy/types').OnRequestDataCallback}
		 */
		(ctx, chunk, next) => {
			debug("onResponseData", chunk.toString());
			next(null, chunk);
		},
	);
	proxy.onResponseEnd(
		/**
		 * @type {import('http-mitm-proxy/types').OnRequestParams}
		 */
		(ctx, next) => {
			debug("onResponseEnd");
			next();
		},
	);
	proxy.onRequestHeaders(
		/**
		 * @type {import('http-mitm-proxy/types').OnRequestParams}
		 */
		(ctx, next) => {
			debug("onRequestHeaders:proxyToServerRequest", ctx.proxyToServerRequestOptions.headers);
			next();
		},
	);

	proxy.onRequest(
		/**
		 * @type {import('http-mitm-proxy/types').OnRequestParams}
		 */
		function onRequest(ctx, done) {
			debug("recieved request", ctx.clientToProxyRequest.headers.host, ctx.clientToProxyRequest.url);
			ctx.use(Proxy.gunzip);

			const recorder = new BodyRecorder();
			recorder.on("finish", async function recorderFinish() {
				const reqStream = recorder.rewind();
				if (ctx.clientToProxyRequest.headers.host?.endsWith("amazonaws.com")) {
					await aws.onRequest(ctx, recorder.chunks);
				}
				ctx.clientToProxyRequest = reqStream;
				done();
			});
			ctx.clientToProxyRequest.pipe(recorder);

			ctx.onRequestData(function (ctx, chunk, next) {
				debug("onRequestData", chunk.toString());
				return next(null, chunk);
			});
			ctx.onRequestEnd(function (ctx, done) {
				debug("ending request");
				return done();
			});
		},
	);

	return proxy;
}

module.exports = {
	create,
};
