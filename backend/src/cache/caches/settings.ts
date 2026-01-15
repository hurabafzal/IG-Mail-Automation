import { db } from "../../db";

type Setting = {
	emailCoolDownDays: number;
	scraping_frequency: number;
	proxyFailCount: number;
};

// const defaultSettings: Setting = {
// 	scraping_frequency: 7,
// 	emailCoolDownDays: 28,
// };

// set default values
console.log("Settings initialized");

export async function get<T extends SettingKey>(keys: SettingKey[] | T) {
	let q = db.selectFrom("Settings").select(["value", "name"]);

	if (Array.isArray(keys)) {
		q = q.where("name", "in", keys);
	} else {
		q = q.where("name", "=", keys);
	}
	const val = await q.execute();

	return val.reduce(
		(acc, { name, value }) => {
			acc[name as T] = value;
			return acc;
		},
		{} as Record<T, string>,
	);
}

export async function getOne<T extends SettingKey>(
	key: T,
): Promise<Setting[T]> {
	const res = await get([key]);
	return Number.parseInt(res[key]);
}

export async function set<T extends SettingKey>(key: T, value: Setting[T]) {
	await db
		.updateTable("Settings")
		.set({ value: value.toString() })
		.where("name", "=", key)
		.execute();
}

export async function increment<T extends SettingKey>(key: T) {
	const val = await getOne(key);
	await db
		.updateTable("Settings")
		.set((eb) => ({
			value: (val + 1).toString(),
		}))
		.where("name", "=", key)
		.execute();
}

type SettingKey = keyof Setting;
