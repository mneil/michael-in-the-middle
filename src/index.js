const stream = require("node:stream");
const { Proxy } = require("http-mitm-proxy");
const debug = require("debug")("proxy");
const { Signature } = require("./signature/aws");

class BodyRecorder extends stream.Transform {
	constructor() {
		super();
		/**
		 * @type {Buffer[]}
		 */
		this.chunks = [];
	}
	/**
	 * @param {Buffer} buf
	 * @param {BufferEncoding} enc
	 * @param {ErrorCallback} next
	 */
	_transform(buf, enc, next) {
		this.chunks.push(buf);
		next();
	}
	rewind() {
		const out = new stream.PassThrough();
		this.chunks.forEach((chunk) => out.write(chunk));
		return out;
	}
}

function run(port = 5465) {
	debug("server starting on port", port);
	return new Promise((resolve) => {
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
			function onRequest(ctx, callback) {
				debug("recieved request", ctx.clientToProxyRequest.headers.host, ctx.clientToProxyRequest.url);
				ctx.use(Proxy.gunzip);

				const recorder = new BodyRecorder();
				recorder.on("finish", async () => {
					const sig = new Signature(ctx.clientToProxyRequest, recorder.chunks);
					await sig.sign();
					debug("signature generated");
					const reqStream = recorder.rewind();
					// uh, this works. Replace the incoming stream with a new readable and let the proxy continue...
					const headers = ctx.clientToProxyRequest.headers;
					headers.authorization = await sig.authorization();
					ctx.clientToProxyRequest = reqStream;
					debug("signed request on behalf of user");
					callback();
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

		debug("begin listening on", port);
		proxy.listen({ port }, () => {
			proxy.port = port;
			debug("server started");
			resolve(proxy);
		});
	});
}

module.exports = { run };

if (require.main === module) {
	run().then((server) => console.log("server is running", server.port));
}
