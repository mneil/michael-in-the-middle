const stream = require("node:stream");
const { Proxy } = require("http-mitm-proxy");
const debug = require("debug")("proxy");
const { Signature } = require("./signature/aws");

class BodyRecorder extends stream.Transform {
	constructor() {
		super();
		this.chunks = [];
	}
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

		proxy.onRequest(function (ctx, callback) {
			debug("recieved request", ctx.clientToProxyRequest.headers.host, ctx.clientToProxyRequest.url);
			ctx.use(Proxy.gunzip);

			const recorder = new BodyRecorder();
			recorder.on("finish", () => {
				const sig = new Signature(ctx.clientToProxyRequest, recorder.chunks);
				sig.sign().then(() => {
					const reqStream = recorder.rewind();
					// uh, this works. Replace the incoming stream with a new readable and let the proxy continue...
					const headers = ctx.clientToProxyRequest.headers;
					headers.authorization = sig.authorization;
					ctx.clientToProxyRequest = reqStream;
					callback();
				});
			});
			ctx.clientToProxyRequest.pipe(recorder);

			ctx.onRequestData(function (ctx, chunk, next) {
				return next(null, chunk);
			});
			ctx.onRequestEnd(function (ctx, done) {
				return done();
			});
			// if (
			// 	ctx.clientToProxyRequest.headers.host == "www.google.com" &&
			// 	ctx.clientToProxyRequest.url.indexOf("/search") == 0
			// ) {
			// 	ctx.use(Proxy.gunzip);
			// 	ctx.onResponseData(function (ctx, chunk, callback) {
			// 		chunk = Buffer.from(chunk.toString().replace(/google/g, "Pwned.com"));
			// 		return callback(null, chunk);
			// 	});
			// }
			// callback();
		});

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
