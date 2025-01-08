const stream = require("node:stream");

class BodyRecorder extends stream.Transform {
	constructor() {
		super();
		/**
		 * @type {Buffer[]}
		 */
		this.chunks = [];
	}
	/**
	 * @param {Buffer} buf
	 * @param {BufferEncoding} enc
	 * @param {ErrorCallback} next
	 */
	_transform(buf, enc, next) {
		this.chunks.push(buf);
		next();
	}
	rewind() {
		const out = new stream.PassThrough();
		this.chunks.forEach((chunk) => out.write(chunk));
		return out;
	}
}

module.exports = {
	BodyRecorder,
};
