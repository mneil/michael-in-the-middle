const fs = require("node:fs");
const path = require("node:path");
const { run } = require("../src");
// const proxy = require("../src");

const port = "5645";
fs.writeFileSync(path.resolve(__dirname, ".port"), port);

exports.mochaGlobalSetup = async function () {
	/**
	 * @type {import("http").Server}
	 */
	this.server = await run(port);
	// this.server = await proxy({ proxy: { port } });
	// console.log("Starting up test server");
};

exports.mochaGlobalTeardown = async function () {
	const self = this;
	await new Promise((resolve, reject) => {
		self.server.close((err) => {
			// console.log("Closing test server success", err ? false : true);
			if (err) return reject(err);
			resolve();
		});
	});
};
