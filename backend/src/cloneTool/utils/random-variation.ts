function getRandomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomChoice<T>(arr: T[]): T {
	return arr[getRandomInt(0, arr.length - 1)];
}

function replaceFirst(s: string): string {
	const letters = "abcdefghijklmnopqrstuvwxyz";
	return getRandomChoice(letters.split("")) + s.slice(1);
}

function doubleChar(s: string): string {
	const i = getRandomInt(0, s.length - 1);
	return s.slice(0, i) + s[i] + s.slice(i);
}

function addChar(s: string): string {
	const letters = "abcdefghijklmnopqrstuvwxyz";
	const i = getRandomInt(0, s.length - 1);
	return s.slice(0, i) + getRandomChoice(letters.split("")) + s.slice(i);
}

function appendNum(s: string): string {
	return s + getRandomInt(0, 9).toString();
}

function appendSep(s: string): string {
	const separators = ["_", "."];
	return s + getRandomChoice(separators);
}

function appendInitials(_s: string): string {
	const letters = "abcdefghijklmnopqrstuvwxyz";
	const s = appendSep(_s);
	return (
		s + getRandomChoice(letters.split("")) + getRandomChoice(letters.split(""))
	);
}

function prependInitials(s: string): string {
	const letters = "abcdefghijklmnopqrstuvwxyz";
	const separators = ["_", "."];
	return (
		getRandomChoice(letters.split("")) +
		getRandomChoice(letters.split("")) +
		getRandomChoice(separators) +
		s
	);
}

function shortenName(name: string): string {
	if (name.length > 30) {
		return name.slice(0, 27);
	}
	return name;
}

export function randomNameVariation(_s: string): string {
	const twisters: ((s: string) => string)[] = [
		replaceFirst,
		doubleChar,
		addChar,
		appendNum,
		appendSep,
		appendInitials,
		prependInitials,
	];
	const randomTwister = getRandomChoice(twisters);
	const s = randomTwister(_s);
	return shortenName(s);
}
