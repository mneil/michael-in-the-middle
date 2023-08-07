const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
const { HttpProxyAgent, HttpsProxyAgent } = require("hpagent");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");
const axios = require("axios");

describe("Auth", () => {
	const port = fs.readFileSync(path.resolve(__dirname, ".port"), "utf-8");
	const ca = fs.readFileSync(path.resolve(__dirname, "..", ".http-mitm-proxy", "certs", "ca.pem"), "utf-8");
	const agent = new HttpsProxyAgent({ proxy: `http://localhost:${port}`, ca: [ca] });

	it.skip("should not get a real identity", async () => {
		// const agent = new HttpProxyAgent({ proxy: `http://localhost:${port}` /*, ca: [ca]*/ });
		const client = new STSClient({
			region: "us-east-1",
			requestHandler: new NodeHttpHandler({
				httpAgent: agent,
				httpsAgent: agent,
			}),
		});
		console.log("about to send a request");
		const res = await client.send(new GetCallerIdentityCommand({}));
		console.log("got a response");
		assert.ok(res);
	});

	it("should get pwnd", (done) => {
		axios
			.get("https://www.google.com/search?q=tree", { httpsAgent: agent })
			.then(function (response) {
				// handle success
				console.log(response.status);
				console.log(response.data);
				done();
			})
			.catch((error) => {
				console.log("error");
				// console.log(error.response.status);
				// console.log(error.response.data);
				done(error);
			});
	});
});
