const fs = require("node:fs");
const path = require("node:path");
const { HttpsProxyAgent } = require("hpagent");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");

let AGENT;

module.exports.handler = function handler() {
	if (AGENT) {
		return AGENT;
	}
	const port = fs.readFileSync(path.resolve(__dirname, ".port"), "utf-8");
	const ca = fs.readFileSync(path.resolve(__dirname, "..", ".http-mitm-proxy", "certs", "ca.pem"), "utf-8");
	const proxyAgent = new HttpsProxyAgent({ proxy: `http://localhost:${port}`, ca: [ca] });

	AGENT = new NodeHttpHandler({
		httpAgent: proxyAgent,
		httpsAgent: proxyAgent,
	});
	return AGENT;
};
