const { Proxy } = require("http-mitm-proxy");
const debug = require("debug")("proxy");

function run(port = 5465) {
	debug("server starting on port", port);
	return new Promise((resolve) => {
		const proxy = new Proxy();

		proxy.onError(function (ctx, err) {
			console.error("proxy error:", err);
		});

		proxy.onRequest(function (ctx, callback) {
			debug("recieved request", ctx.clientToProxyRequest.headers.host, ctx.clientToProxyRequest.url);
			if (
				ctx.clientToProxyRequest.headers.host == "www.google.com" &&
				ctx.clientToProxyRequest.url.indexOf("/search") == 0
			) {
				ctx.use(Proxy.gunzip);
				ctx.onResponseData(function (ctx, chunk, callback) {
					chunk = Buffer.from(chunk.toString().replace(/google/g, "Pwned.com"));
					return callback(null, chunk);
				});
			}
			return callback();
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
