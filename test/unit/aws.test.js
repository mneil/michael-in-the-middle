const assert = require("node:assert");
const aws = require("../../src/provider/aws");

describe("aws", () => {
	describe("signature", () => {
		it("Should create correct headers", async function () {
			this.timeout(10000);

			const inputRequest = {
				headers: {
					connection: "close",
					authorization:
						"AWS4-HMAC-SHA256 Credential=A/20241121/us-west-2/sts/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=a",
					"x-amz-date": "20241121T224122Z",
					host: "sts.us-west-2.amazonaws.com",
					"content-type": "application/x-www-form-urlencoded; charset=utf-8",
					"accept-encoding": "identity",
					"user-agent":
						"aws-cli/2.2.32 Python/3.8.8 Linux/5.15.167.4-microsoft-standard-WSL2 exe/x86_64.ubuntu.22 prompt/off command/sts.get-caller-identity",
					"content-length": "43",
				},
				method: "POST",
				url: "/",
			};
			const signature = new aws.Signature(inputRequest, [Buffer.from("Action=GetCallerIdentity&Version=2011-06-15")]);
			signature.credentials = () => {
				return {
					accessKeyId: "foo",
					secretAccessKey: "bar/baz",
				};
			};
			await signature.sign();
			assert.equal(
				JSON.stringify(signature.canonicalHeaders),
				JSON.stringify([
					["content-type", "application/x-www-form-urlencoded; charset=utf-8"],
					["host", "sts.us-west-2.amazonaws.com"],
					["x-amz-date", "20241121T224122Z"],
				]),
				"Invalid canonicalHeaders",
			);
			assert.equal(
				JSON.stringify(signature.signedHeaders),
				JSON.stringify(["content-type", "host", "x-amz-date"]),
				"Invalid signedHeaders",
			);
			assert.equal(
				signature.bodySha256,
				"ab821ae955788b0e33ebd34c208442ccfc2d406e2edc5e7a39bd6458fbb4f843",
				"Invalid bodySha256",
			);
			assert.equal(signature.ISOdate, "20241121T224122Z", "Invalid ISOdate");
			assert.equal(signature.date, "20241121", "Invalid date");
			assert.equal(signature.scope, "20241121/us-west-2/sts/aws4_request", "Invalid scope");
			assert.equal(
				await signature.authorization(),
				"AWS4-HMAC-SHA256 Credential=foo/20241121/us-west-2/sts/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=69f3d085a3d4020f503be9b39381432018c927c9ec30cc4baa8b856a023c74c1",
				"Invalid authorization header",
			);
		});
	});
});
