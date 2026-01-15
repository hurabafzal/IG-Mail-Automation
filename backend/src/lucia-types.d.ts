/// <reference types="lucia" />
declare namespace Lucia {
	type Auth = import("./lucia").Auth;
	type DatabaseUserAttributes = {
		username: string;
		email: string;
		pfp: string;
	};
	// biome-ignore lint/complexity/noBannedTypes: it literally is {}
	type DatabaseSessionAttributes = {};
}
