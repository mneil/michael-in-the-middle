require("./debug");
const debug = require("debug")("mitm:server");
const { create } = require("./proxy");

function run(port = 5465) {
	debug("starting on port", port);
	return new Promise((resolve) => {
		const proxy = create();

		debug("listening on", port);
		proxy.listen({ port }, () => {
			proxy.port = port;
			debug("started");
			resolve(proxy);
		});
	});
}

module.exports = { run };

if (require.main === module) {
	run().then((server) => console.log("server is running", server.port));
}
