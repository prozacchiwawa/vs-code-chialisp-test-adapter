export class StringBufAccumulator {
	inputBuffer : string = "";

	addChunk(chunk : string | Buffer, stringcb : (s : string) => void) {
		if (typeof(chunk) === 'string') {
			this.inputBuffer = this.inputBuffer + chunk;
		} else if (chunk.toString) {
			this.inputBuffer = this.inputBuffer + chunk.toString('utf8');
		}

		let last = 0;
		let found = this.inputBuffer.indexOf('\n');

		while (found > -1 && found < this.inputBuffer.length) {
			const substr = this.inputBuffer.substr(last, found - last);
			stringcb(substr);
			last = found + 1;
			found = this.inputBuffer.indexOf('\n', last);
		}

		this.inputBuffer = this.inputBuffer.substr(last);
	}
};
