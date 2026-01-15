export enum BitmapTrigger {
	Opener = 0,
	HiddenLikes = 1,
	FollowingIncrease = 2,
	FollowerLoss = 3,
	Opener2 = 4,
	Opener3 = 5,
	HiddenLikes2 = 6,
	FollowerLoss2 = 7,
	FollowingChange2 = 8,

	HiddenLikes3 = 9,
	FollowingChange3 = 10,
	FollowerDrop3 = 11,

	// Add more triggers as needed
}

// Utility functions for bitmap operations
export const setBit = (bitmap: number, trigger: BitmapTrigger): number => {
	return bitmap | (1 << trigger);
};

export const clearBit = (bitmap: number, trigger: BitmapTrigger): number => {
	return bitmap & ~(1 << trigger);
};

export const isBitSet = (bitmap: number, trigger: BitmapTrigger): boolean => {
	return (bitmap & (1 << trigger)) !== 0;
};

function getLargestEnumValue(enumObject: object): number {
	const values = Object.values(enumObject)
		.filter((value) => typeof value === "number")
		.map((value) => Number(value));

	return values.length > 0 ? Math.max(...values) : Number.NaN;
}

export const BitmapTriggerLength = getLargestEnumValue(BitmapTrigger) + 1;
