const crypto = require("node:crypto");
const debug = require("debug")("mitm:signature:aws");
const { fromInstanceMetadata, fromIni, fromEnv } = require("@aws-sdk/credential-providers"); // ES6 import

async function credentialChain() {
	let credentials;
	try {
		credentials = await fromEnv({})();
		return credentials;
	} catch (e) {}
	try {
		credentials = await fromInstanceMetadata({})();
		return credentials;
	} catch (e) {}
	try {
		credentials = await fromIni({})();
		return credentials;
	} catch (e) {}
	throw new Error("Unable to obtain AWS Credentials");
}

class Signature {
	#signedHeaders = [];
	#bodySha256 = "";
	#ISOdate = "";
	#date = "";
	#scope = "";
	#credentials = "";
	#signature = "";
	constructor(request, body) {
		this.signature = "";
		this.request = request;
		this.chunks = body;
		this.region = "";
		this.service = "";
	}

	async authorization() {
		if (!this.#signature) {
			throw new Error("Must sign payload before getting the athorization header");
		}
		const header = `AWS4-HMAC-SHA256 Credential=${(await this.credentials()).accessKeyId}/${
			this.#scope
		}, SignedHeaders=${this.signedHeaders.join(";")}, Signature=${this.#signature}`;
		return header;
	}
	get canonicalHeaders() {
		return this.signedHeaders.map((header) => {
			return [header, this.request.headers[header]];
		});
	}
	get signedHeaders() {
		if (this.#signedHeaders.length) {
			return this.#signedHeaders;
		}
		this.#signedHeaders = this.request.headers.authorization.split("SignedHeaders=")[1].split(",")[0].split(";").sort();
		return this.#signedHeaders;
	}
	get bodySha256() {
		if (this.#bodySha256) {
			return this.#bodySha256;
		}
		const body = this.chunks.join();
		const hash = crypto.createHash("sha256");
		hash.update(body);
		this.#bodySha256 = Buffer.from(hash.digest()).toString("hex");
		return this.#bodySha256;
	}
	get ISOdate() {
		if (this.#ISOdate) {
			return this.#ISOdate;
		}
		this.#ISOdate = this.canonicalHeaders.filter(([h, _]) => h == "x-amz-date")[0][1];
		return this.#ISOdate;
	}
	get date() {
		if (this.#date) {
			return this.#date;
		}
		this.#date = this.ISOdate.substring(0, 8);
		return this.#date;
	}
	get scope() {
		if (this.#scope) {
			return this.#scope;
		}
		// 20230809/us-east-1/sts/aws4_request
		const creds = this.request.headers.authorization.split("Credential=")[1].split(",")[0];
		const scope = creds.split("/").slice(-4);
		this.region = scope[1];
		this.service = scope[2];
		this.#scope = `${scope.join("/")}`;
		return this.#scope;
	}
	async credentials() {
		if (this.#credentials) {
			return this.#credentials;
		}
		this.#credentials = await credentialChain();
		return this.#credentials;
	}
	async sign() {
		const stringToSign = this.#stringToSign();
		const signingKey = await this.#signingKey();
		const hash = crypto.createHmac("sha256", signingKey);
		hash.update(stringToSign);
		this.#signature = Buffer.from(hash.digest()).toString("hex");
		return this.#signature;
	}
	async #signingKey() {
		const hmac = (key, data) => {
			const hash = crypto.createHmac("sha256", key);
			hash.update(data);
			const digest = hash.digest(undefined);
			return digest;
		};
		let key = `AWS4${(await this.credentials()).secretAccessKey}`;
		for (const signable of [this.date, this.region, this.service, "aws4_request"]) {
			key = hmac(key, signable);
		}
		return key;
	}
	#stringToSign() {
		const canonical = this.#canonicalRequest();
		const hash = crypto.createHash("sha256");
		hash.update(canonical);
		const result = Buffer.from(hash.digest()).toString("hex");
		const stringToSign = "AWS4-HMAC-SHA256\n" + `${this.ISOdate}\n` + `${this.scope}` + "\n" + result;
		return stringToSign;
	}
	#canonicalRequest() {
		debug("canonicalRequest:canonicalHeaders", this.canonicalHeaders);
		debug("canonicalRequest:bodySha256", this.bodySha256);
		const canonicalRequest =
			`${this.request.method}\n` +
			`${this.request.url}\n` +
			`\n` + // TODO: query params go here on this line before the \n
			this.canonicalHeaders
				.map(([key, value]) => `${key.toLowerCase()}:${value.trim()}`)
				.sort()
				.join("\n") +
			"\n\n" +
			`${this.signedHeaders.join(";")}` +
			(this.bodySha256 ? `\n${this.bodySha256}` : "");
		return canonicalRequest;
	}
}

module.exports = {
	Signature,
	credentialChain,
};
