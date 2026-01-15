import type { app } from "./api/app";
import type { Company } from "./api/outreach";
import type * as DB_TYPES from "./db/db_types";
import { filterSchema } from "./utils/filterSchema";

export type App = typeof app;

export type { DB_TYPES };

export type UserAttributes = {
	username: string;
	email?: string;
	pfp: string;
};

export type Lead = Company;

export { filterSchema };
