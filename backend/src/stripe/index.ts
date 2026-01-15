import { Console, Effect, pipe } from "effect";
import { Stripe } from "stripe";
import { env } from "../env";

const stripeClient = new Stripe(env.STRIPE_KEY);

const getAllCustomers = pipe(
	Effect.iterate(
		{
			customers: [] as Stripe.Customer[],
			hasMore: true,
			startingAfter: undefined as string | undefined,
		},
		{
			while: ({ hasMore }) => hasMore,
			body: ({ customers, startingAfter }) =>
				pipe(
					Effect.promise(() =>
						startingAfter
							? stripeClient.customers.list({
									limit: 100,
									starting_after: startingAfter,
								})
							: stripeClient.customers.list({
									limit: 100,
								}),
					),
					Effect.map((response) => ({
						customers: [...customers, ...response.data],
						hasMore: response.has_more,
						startingAfter: response.data[response.data.length - 1]?.id,
					})),
					Effect.tap(({ customers }) =>
						Console.log(`we got ${customers.length} stripe customers`),
					),
				),
		},
	),
	Effect.map((c) => c.customers),
);

// Effect.runPromise(
// 	pipe(
// 		getAllCustomers,
// 		Effect.tap((customers) =>
// 			Console.log(`Total customers: ${customers.length}`),
// 		),
// 	),
// ).catch(console.error);

export const stripe = {
	getAllCustomers,
};
