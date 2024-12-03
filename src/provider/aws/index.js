const debug = require("debug")("mitm:provider:aws");
const { Signature } = require("./signature");

/**
 * @param {import("http-mitm-proxy").IContext} ctx
 * @param {Buffer[]} body
 */
async function onRequest(ctx, body) {
	debug("signing AWS request on behalf of user");
	const sig = new Signature(ctx.clientToProxyRequest, body);
	await sig.sign();
	debug("signature generated");
	// uh, this works. Replace the incoming stream with a new readable and let the proxy continue...
	const headers = ctx.clientToProxyRequest.headers;
	headers.authorization = await sig.authorization();
	// ctx.clientToProxyRequest = reqStream;
	debug("signed request on behalf of user");
}

module.exports = {
	onRequest,
	Signature,
};
