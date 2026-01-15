export const daysAgo = (n: number) =>
	new Date(new Date().getTime() - n * 24 * 60 * 60 * 1000);
