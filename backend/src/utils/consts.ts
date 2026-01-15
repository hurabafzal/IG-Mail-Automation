export const SEARCH_COUNTRIES = [
	"Germany",
	"Austria",
	"Switzerland",
	"Netherlands",
	"Belgium",
	"GERMAN_CAPTIONS",
	"United States",
];

export const DE_ACTIVE_COUNTRIES = [
	"Germany",
	"Austria",
	"Switzerland",
	"GERMAN_CAPTIONS",
];
export const NL_ACTIVE_COUNTRIES = ["Netherlands", "Belgium"];

export const ACTIVE_COUNTRIES = [
	...DE_ACTIVE_COUNTRIES,
	...NL_ACTIVE_COUNTRIES,
];

export const EN_ACTIVE_COUNTRIES = [
	"United Kingdom",
	"France",
	"Sweden",
	"Norway",
	"Denmark",
	"Finland",
	"Ireland",
	"Luxembourg",
	"United States",
];

export const COUNTRY_GROUPS = [
	{
		id: "DE" as const,
		countries: DE_ACTIVE_COUNTRIES,
		bioLanguage: undefined,
	},
	{
		id: "EN" as const,
		countries: EN_ACTIVE_COUNTRIES,
		bioLanguage: "EN",
	},
	{
		id: "NL" as const,
		countries: NL_ACTIVE_COUNTRIES,
		bioLanguage: undefined,
	},
] as const;

export type CountryGroup = (typeof COUNTRY_GROUPS)[number];

export const sequenceFolderIds = [
	"65dc9e1a3f411e03be7d544e",
	"66befcef82ccbe192cf81a10",
	"671e96f150ca1d3bb0829bbb",
] as const;

export type InstantlyCampaign = {
	id: string;
	name: string;
	language: "EN" | "DE" | "NL";
	subsequences: {
		id: string;
		name: "Follower Drop" | "Following Change" | "Hidden Likes";
	}[];
};

export const instantlyCampaigns = {
	"🇩🇪 Campaign 1": {
		id: "622dbf92-2ceb-413f-ac00-c6e6135eaf3e",
		name: "🇩🇪 Campaign 1",
		language: "DE",
		subsequences: [
			{
				id: "df052d11-df4f-49b4-b8d3-cf952d103cc3",
				name: "Following Change",
			},
			{
				id: "aba3c268-ec6b-43a0-aa82-0bbe0c1093c8",
				name: "Follower Drop",
			},
			{
				id: "a4cdbfeb-dc56-4e5e-b8ee-aab772f28439",
				name: "Hidden Likes",
			},
		],
	},
	"🇩🇪 Campaign 2": {
		id: "d98f4120-88f3-4401-a96a-575e7774d71f",
		name: "🇩🇪 Campaign 2",
		language: "DE",
		subsequences: [
			{
				id: "1e2dfcfc-5d29-436f-b3a1-c278f43892a7",
				name: "Hidden Likes",
			},
			{
				id: "b1e6cc86-0859-4f41-815d-8a571e9a9758",
				name: "Follower Drop",
			},
			{
				id: "a7634203-f42a-4080-b4f6-2cb5cb4adfaf",
				name: "Following Change",
			},
		],
	},
	"🇩🇪 Campaign 3": {
		id: "119c2ac2-8b69-489d-95da-fccf37796d3f",
		name: "🇩🇪 Campaign 3",
		language: "DE",
		subsequences: [
			{
				id: "8369f939-68a9-4e01-b402-9f7faaa55d5d",
				name: "Following Change",
			},
			{
				id: "8b22d95b-7151-4da0-9871-1de41ddae7a6",
				name: "Follower Drop",
			},
			{
				id: "0c3c9d07-b830-4f99-ab13-98d49120c5d8",
				name: "Hidden Likes",
			},
		],
	},
	// "🇩🇪 Campaign 4": {
	// 	id: "119c2ac2-8b69-489d-95da-fccf37796d3ff",
	// 	name: "🇩🇪 Campaign 4",
	// 	language: "DE",
	// 	subsequences: [
	// 		{
	// 			id: "8369f939-68a9-4e01-b402-9f7faaa55d5dd",
	// 			name: "Following Change",
	// 		},
	// 		{
	// 			id: "8b22d95b-7151-4da0-9871-1de41ddae7a66",
	// 			name: "Follower Drop",
	// 		},
	// 		{
	// 			id: "0c3c9d07-b830-4f99-ab13-98d49120c5d88",
	// 			name: "Hidden Likes",
	// 		},
	// 	],
	// },
} as const satisfies Record<string, InstantlyCampaign>;
