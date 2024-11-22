const assert = require("node:assert");
const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
const { handler } = require("./agent");

describe("Auth", () => {
	it("should not get a real identity", async function () {
		this.timeout(10000);
		const client = new STSClient({
			region: "us-east-1",
			credentials: {
				accessKeyId: "a",
				secretAccessKey: "b",
			},
			requestHandler: handler(),
		});
		const res = await client.send(new GetCallerIdentityCommand({}));
		assert.ok(res);
	});
});
