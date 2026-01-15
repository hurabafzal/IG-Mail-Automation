// import { HttpClientResponse } from "@effect/platform";
// import { Schema as S } from "@effect/schema";
// import { Console, Effect, pipe } from "effect";
// import { DelRes, FindRes, Pipedrive, PostRes } from "../types";
// import { swapKeys } from "../utils";
// import {
// 	DealFindRes,
// 	type DealItemT,
// 	DealMailMessagesRes,
// 	type DealUpdate,
// 	type NewDeal,
// 	NewDealEncoded,
// 	dealPairs,
// } from "./deal.schema";

// export const DealPipedrive = {
// 	getAllWon: () =>
// 		Effect.iterate(
// 			{
// 				data: [] as DealItemT[],
// 				more_items_in_collection: true,
// 				next_start: 0,
// 			},
// 			{
// 				while: (result) => result.more_items_in_collection,
// 				body: (result) =>
// 					pipe(
// 						Pipedrive.get("/deals", {
// 							start: result.next_start,
// 						}),
// 						Effect.tap(Console.log(`got res for start ${result.next_start}`)),
// 						Effect.flatMap(HttpClientResponse.schemaBodyJson(DealFindRes)),
// 						Effect.map((x) => ({
// 							data: [...result.data, ...x.data],
// 							more_items_in_collection:
// 								x.additional_data.pagination.more_items_in_collection,
// 							next_start: x.additional_data.pagination.next_start ?? -1,
// 						})),
// 						Effect.tap(Effect.sleep(100)),
// 					),
// 			},
// 		).pipe(Effect.map((x) => x.data.filter((x) => x.stage_id === 3))),
// 	getAll: () =>
// 		pipe(
// 			Effect.iterate(
// 				{
// 					data: [] as DealItemT[],
// 					more_items_in_collection: true,
// 					next_start: 0,
// 				},
// 				{
// 					while: (result) => result.more_items_in_collection,
// 					body: (result) =>
// 						pipe(
// 							Pipedrive.get("/deals", {
// 								start: result.next_start,
// 							}),
// 							Effect.tap(
// 								Console.log(`[deals] got res for start ${result.next_start}`),
// 							),
// 							Effect.flatMap(HttpClientResponse.schemaBodyJson(DealFindRes)),
// 							Effect.map((x) => ({
// 								data: [...result.data, ...x.data],
// 								more_items_in_collection:
// 									x.additional_data.pagination.more_items_in_collection,
// 								next_start: x.additional_data.pagination.next_start ?? -1,
// 							})),
// 							Effect.tap(Effect.sleep(100)),
// 						),
// 				},
// 			),
// 			Effect.scoped,
// 		),

// 	getDealsNeedingFollowUp: () =>
// 		pipe(
// 			Effect.iterate(
// 				{
// 					data: [] as DealItemT[],
// 					more_items_in_collection: true,
// 					next_start: 0,
// 				},
// 				{
// 					while: (result) => result.more_items_in_collection,
// 					body: (result) =>
// 						pipe(
// 							Pipedrive.get("/deals", {
// 								start: result.next_start,
// 								status: "open",
// 							}),
// 							Effect.tap(
// 								Console.log(`[deals] got res for start ${result.next_start}`),
// 							),
// 							Effect.flatMap(HttpClientResponse.schemaBodyJson(DealFindRes)),
// 							Effect.map((x) => ({
// 								data: [...result.data, ...x.data],
// 								more_items_in_collection:
// 									x.additional_data.pagination.more_items_in_collection,
// 								next_start: x.additional_data.pagination.next_start ?? -1,
// 							})),
// 							Effect.tap(Effect.sleep(100)),
// 						),
// 				},
// 			),
// 			Effect.scoped,
// 		),
// 	add: (params: S.Schema.Encoded<typeof NewDeal>) =>
// 		pipe(
// 			swapKeys(dealPairs, params),
// 			Effect.flatMap(S.decodeUnknown(NewDealEncoded)),
// 			Effect.flatMap((p) => Pipedrive.post("/deals", p)),
// 			Effect.flatMap(HttpClientResponse.schemaBodyJson(PostRes)),
// 			Effect.scoped,
// 		),
// 	update: (id: number, params: S.Schema.Encoded<typeof DealUpdate>) =>
// 		pipe(
// 			swapKeys(dealPairs, params),
// 			Effect.flatMap((p) => Pipedrive.put(`/deals/${id}`, p)),
// 			Effect.flatMap(HttpClientResponse.schemaBodyJson(PostRes)),
// 			Effect.scoped,
// 		),
// 	findFromPerson: (person_id: number) =>
// 		pipe(
// 			Pipedrive.get(`/persons/${person_id}/deals`),
// 			Effect.flatMap(HttpClientResponse.schemaBodyJson(FindRes)),
// 			Effect.scoped,
// 		),
// 	getMailMessages: (
// 		deal_id: number,
// 		params?: { start?: number; limit?: number },
// 	) =>
// 		pipe(
// 			Pipedrive.get(`/deals/${deal_id}/mailMessages`, {
// 				start: params?.start ?? 0,
// 				limit: params?.limit ?? 100,
// 			}),
// 			Effect.flatMap(HttpClientResponse.schemaBodyJson(DealMailMessagesRes)),
// 			Effect.scoped,
// 		),
// 	delete: (id: number) =>
// 		pipe(
// 			Pipedrive.del(`/deals/${id}`),
// 			Effect.flatMap(HttpClientResponse.schemaBodyJson(DelRes)),
// 			Effect.scoped,
// 		),
// };

import { HttpClientResponse } from "@effect/platform";
import { Schema as S } from "@effect/schema";
import { Console, Effect, pipe } from "effect";
import { DelRes, FindRes, Pipedrive, PostRes } from "../types";
import { swapKeys } from "../utils";
import {
	DealFindRes,
	type DealItemT,
	DealMailMessagesRes,
	type DealUpdate,
	type NewDeal,
	NewDealEncoded,
	dealPairs,
} from "./deal.schema";

export const DealPipedrive = {
	getAllWon: () =>
		Effect.iterate(
			{
				data: [] as DealItemT[],
				more_items_in_collection: true,
				next_start: 0,
			},
			{
				while: (result) => result.more_items_in_collection,
				body: (result) =>
					pipe(
						Pipedrive.get("/deals", {
							start: result.next_start,
						}),
						Effect.tap(Console.log(`got res for start ${result.next_start}`)),
						Effect.flatMap(HttpClientResponse.schemaBodyJson(DealFindRes)),
						Effect.map((x) => ({
							data: [...result.data, ...x.data],
							more_items_in_collection:
								x.additional_data.pagination.more_items_in_collection,
							next_start: x.additional_data.pagination.next_start ?? -1,
						})),
						Effect.tap(Effect.sleep(100)),
					),
			},
		).pipe(Effect.map((x) => x.data.filter((x) => x.stage_id === 3))),
	getAll: () =>
		pipe(
			Effect.iterate(
				{
					data: [] as DealItemT[],
					more_items_in_collection: true,
					next_start: 0,
				},
				{
					while: (result) => result.more_items_in_collection,
					body: (result) =>
						pipe(
							Pipedrive.get("/deals", {
								start: result.next_start,
							}),
							Effect.tap(
								Console.log(`[deals] got res for start ${result.next_start}`),
							),
							Effect.flatMap(HttpClientResponse.schemaBodyJson(DealFindRes)),
							Effect.map((x) => ({
								data: [...result.data, ...x.data],
								more_items_in_collection:
									x.additional_data.pagination.more_items_in_collection,
								next_start: x.additional_data.pagination.next_start ?? -1,
							})),
							Effect.tap(Effect.sleep(100)),
						),
				},
			),
			Effect.scoped,
		),
	getTestphaseDeals: () =>
		pipe(
			Effect.iterate(
				{
					data: [] as DealItemT[],
					more_items_in_collection: true,
					next_start: 0,
				},
				{
					while: (result) => result.more_items_in_collection,
					body: (result) =>
						pipe(
							Pipedrive.get("/deals", {
								start: result.next_start,
								status: "open",
							}),
							Effect.tap(
								Console.log(
									`[testphase deals] got res for start ${result.next_start}`,
								),
							),
							Effect.flatMap(HttpClientResponse.schemaBodyJson(DealFindRes)),
							Effect.map((x) => ({
								data: [...result.data, ...x.data],
								more_items_in_collection:
									x.additional_data.pagination.more_items_in_collection,
								next_start: x.additional_data.pagination.next_start ?? -1,
							})),
							Effect.tap(Effect.sleep(100)),
						),
				},
			),
			Effect.map((x) =>
				x.data.filter((deal) => deal.stage_id === 3 || deal.stage_id === 24),
			), // Filter for stage 3 (testphase)
			Effect.scoped,
		),
	getAllByPersonId: (person_id: number) =>
		pipe(
			Pipedrive.get(`/persons/${person_id}/deals`),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(FindRes)),
			Effect.map((res) => ({
				success: true,
				data: res.data || [],
			})),
			Effect.scoped,
		),

	getDealsNeedingFollowUp: () =>
		pipe(
			Effect.iterate(
				{
					data: [] as DealItemT[],
					more_items_in_collection: true,
					next_start: 0,
				},
				{
					while: (result) => result.more_items_in_collection,
					body: (result) =>
						pipe(
							Pipedrive.get("/deals", {
								start: result.next_start,
								status: "open",
							}),
							Effect.tap(
								Console.log(`[deals] got res for start ${result.next_start}`),
							),
							Effect.flatMap(HttpClientResponse.schemaBodyJson(DealFindRes)),
							Effect.map((x) => ({
								data: [...result.data, ...x.data],
								more_items_in_collection:
									x.additional_data.pagination.more_items_in_collection,
								next_start: x.additional_data.pagination.next_start ?? -1,
							})),
							Effect.tap(Effect.sleep(100)),
						),
				},
			),
			Effect.scoped,
		),
	add: (params: S.Schema.Encoded<typeof NewDeal>) =>
		pipe(
			swapKeys(dealPairs, params),
			Effect.flatMap(S.decodeUnknown(NewDealEncoded)),
			Effect.flatMap((p) => Pipedrive.post("/deals", p)),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(PostRes)),
			Effect.scoped,
		),
	update: (id: number, params: S.Schema.Encoded<typeof DealUpdate>) =>
		pipe(
			swapKeys(dealPairs, params),
			Effect.flatMap((p) => Pipedrive.put(`/deals/${id}`, p)),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(PostRes)),
			Effect.scoped,
		),
	findFromPerson: (person_id: number) =>
		pipe(
			Pipedrive.get(`/persons/${person_id}/deals`),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(FindRes)),
			Effect.scoped,
		),
	getMailMessages: (
		deal_id: number,
		params?: { start?: number; limit?: number },
	) =>
		pipe(
			Pipedrive.get(`/deals/${deal_id}/mailMessages`, {
				start: params?.start ?? 0,
				limit: params?.limit ?? 100,
			}),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(DealMailMessagesRes)),
			Effect.scoped,
		),
	delete: (id: number) =>
		pipe(
			Pipedrive.del(`/deals/${id}`),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(DelRes)),
			Effect.scoped,
		),
};
