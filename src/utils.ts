declare global {
	interface String {
		toTitleCase(): string;
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

export const getNonce = () => {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
};
