const crypto = require("node:crypto");
const { SignatureV4 } = require("@smithy/signature-v4");

class sha256 {
	constructor(key) {
		if (!key) {
			this.hash = crypto.createHash("sha256");
		} else {
			this.hash = crypto.createHmac("sha256", key);
		}
	}
	update(value) {
		this.hash.update(value);
	}
	digest(format) {
		return this.hash.digest(format);
	}
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
	get authorization() {
		if (!this.#signature) {
			throw new Error("Must sign payload before getting the athorization header");
		}
		const header = `AWS4-HMAC-SHA256 Credential=${this.#credentials.accessKeyId}/${
			this.#scope
		}, SignedHeaders=${this.signedHeaders.join(";")}, Signature=${this.#signature}`;
		return header;
	}
	get canonicalHeaders() {
		return Object.entries(this.request.headers)
			.filter(([key, _]) => {
				return !["authorization", "connection", "user-agent"].includes(key);
			})
			.sort();
	}
	get signedHeaders() {
		if (this.#signedHeaders.length) {
			return this.#signedHeaders;
		}
		this.#signedHeaders = this.request.headers.authorization.split("SignedHeaders=")[1].split(",")[0].split(";");
		return this.#signedHeaders;
	}
	get bodySha256() {
		if (this.#bodySha256) {
			return this.#bodySha256;
		}
		this.#bodySha256 = this.canonicalHeaders.filter(([h, _]) => h == "x-amz-content-sha256")[0][1];
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
		this.#date = this.ISOdate.substring(0, 7);
		return this.#date;
	}

	async credentials() {
		if (this.#credentials) {
			return this.#credentials;
		}
		await Promise.resolve();
		this.#credentials = {};
		return this.#credentials;
	}
	async sign() {
		const stringToSign = await this._stringToSign();

		const sig = new SignatureV4({
			credentials: await this.credentials(),
			region: this.region,
			service: this.service,
			sha256: sha256,
		});

		const d = new Date();
		d.setUTCFullYear(this.#ISOdate.slice(0, 4));
		d.setUTCMonth(Number(this.#ISOdate.slice(4, 6)) - 1);
		d.setUTCDate(this.#ISOdate.slice(6, 8));
		d.setUTCHours(this.#ISOdate.slice(9, 11));
		d.setUTCMinutes(this.#ISOdate.slice(11, 13));
		d.setUTCSeconds(this.#ISOdate.slice(13, 15));

		this.#signature = await sig.sign(stringToSign, {
			signingDate: d,
		});

		return this.#signature;
	}

	async scope() {
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

	async _stringToSign() {
		const canonical = this._canonicalRequest();
		const hash = crypto.createHash("sha256");
		hash.update(canonical);
		const result = Buffer.from(await hash.digest()).toString("hex");
		const stringToSign = "AWS4-HMAC-SHA256\n" + `${this.ISOdate}\n` + `${await this.scope()}` + "\n" + result;
		return stringToSign;
	}

	// keep
	_canonicalRequest() {
		const canonicalRequest =
			`${this.request.method}\n` +
			`${this.request.url}\n` +
			`\n` + // TODO: query params go here on this line before the \n
			this.canonicalHeaders
				.map(([key, value]) => `${key.toLowerCase()}:${value.trim()}`)
				.sort()
				.join("\n") +
			"\n\n" +
			`${this.signedHeaders.join(";")}\n` +
			this.bodySha256;
		return canonicalRequest;
	}
}

module.exports = {
	Signature,
};
