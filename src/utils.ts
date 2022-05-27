declare global {
	interface String {
		toTitleCase(): string;
		hashCode(asString: boolean): number | string;
	}
}

String.prototype.toTitleCase = function () {
	let splitted = this.split(' ');
	let modified = splitted.map(word => {
		if (!word) { return ''; }
		let [firstChar, ...rest] = word;
		return `${firstChar.toUpperCase()}${rest.join('')}`;
	});
	return modified.join(' ');
};

String.prototype.hashCode = function (asString?: boolean) {
	let hash = 0;
	for (let i = 0; i < this.length; ++i) {
		hash = Math.imul(31, hash) + this.charCodeAt(i);
	}
	hash = (hash * -1) | 0;
	if (asString) {
		return hash.toString();
	}
	return hash;
};

export const getNonce = () => {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
};

export const getRandomInt = (min: number, max: number) => {
	return Math.floor(
		Math.random() * (max - min + 1) + min
	);
};
