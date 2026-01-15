import { is } from "effect/ParseResult";
import { z } from "zod";

const edges_schema = z.array(
	z.object({
		node: z.object({
			id: z.string(),
			shortcode: z.string(),
			display_url: z.string(),
			owner: z.object({ id: z.string(), username: z.string() }),
			is_video: z.boolean(),
			has_upcoming_event: z.boolean(),
			edge_media_to_caption: z.object({
				edges: z.array(z.object({ node: z.object({ text: z.string() }) })),
			}),
			edge_media_to_comment: z.object({ count: z.number() }),
			comments_disabled: z.boolean(),
			taken_at_timestamp: z.number(),
			edge_liked_by: z.object({ count: z.number() }),
			edge_media_preview_like: z.object({ count: z.number() }),
			location: z.unknown().nullish(),
			nft_asset_info: z.string().nullish(),
			thumbnail_src: z.string(),
			coauthor_producers: z.array(
				z.object({
					id: z.string(),
					is_verified: z.boolean(),
					profile_pic_url: z.string(),
					username: z.string(),
				}),
			),
			pinned_for_users: z.array(
				z.object({
					id: z.string(),
					is_verified: z.boolean(),
					profile_pic_url: z.string(),
					username: z.string(),
				}),
			),
			viewer_can_reshare: z.boolean(),
		}),
	}),
);

export const about_schema = z.object({
	username: z.string(),
	is_verified: z.boolean(),
	country: z.string(),
	date: z.string(),
	former_usernames: z.string(),
});

export const user_by_id_schema = z.object({
	user: z
		.object({
			public_email: z.string().nullish(),
			follower_count: z.number().nullish(),
			following_count: z.number().nullish(),
			media_count: z.number().nullish(),
			username: z.string().nullish(),
			external_url: z.string().nullish(),
			profile_pic_url_hd: z.string().nullish(),
			profile_pic_url: z.string().nullish(),
			full_name: z.string().nullish(),
			biography: z.string().nullish(),
			is_private: z.boolean().nullish(),
		})
		.nullish(),
	status: z.string(),
	// "detail": "User not found",
	// "exc_type": "UserNotFound"
});

export const web_profile_schema = z.object({
	user: z
		.object({
			ai_agent_type: z.string().nullish(),
			biography: z.string(),
			bio_links: z.array(z.unknown()),
			// fb_profile_biolink: z.unknown().nullish(),
			biography_with_entities: z.object({
				raw_text: z.string(),
				entities: z.array(z.unknown()),
			}),
			country_block: z.boolean(),
			eimu_id: z.string(),
			external_url: z.string().nullish(),
			external_url_linkshimmed: z.string().nullish(),
			edge_followed_by: z.object({ count: z.number() }),
			fbid: z.string(),
			followed_by_viewer: z.boolean(),
			edge_follow: z.object({ count: z.number() }),
			follows_viewer: z.boolean(),
			full_name: z.string(),
			// group_metadata: z.string().nullish(),
			has_ar_effects: z.boolean(),
			has_clips: z.boolean(),
			has_guides: z.boolean(),
			has_channel: z.boolean(),
			has_blocked_viewer: z.boolean(),
			highlight_reel_count: z.number(),
			has_requested_viewer: z.boolean(),
			hide_like_and_view_counts: z.boolean(),
			id: z.string(),
			is_business_account: z.boolean(),
			is_professional_account: z.boolean(),
			is_supervision_enabled: z.boolean(),
			is_guardian_of_viewer: z.boolean(),
			is_supervised_by_viewer: z.boolean(),
			is_supervised_user: z.boolean(),
			is_embeds_disabled: z.boolean(),
			is_joined_recently: z.boolean(),
			guardian_id: z.string().nullish(),
			business_address_json: z.string().nullish(),
			business_contact_method: z.string(),
			business_email: z.string().nullish(),
			business_phone_number: z.string().nullish(),
			business_category_name: z.string().nullish(),
			overall_category_name: z.string().nullish(),
			category_enum: z.string().nullish(),
			category_name: z.string().nullish(),
			is_private: z.boolean(),
			is_verified: z.boolean(),
			is_verified_by_mv4b: z.boolean(),
			is_regulated_c18: z.boolean(),
			edge_mutual_followed_by: z.object({
				count: z.number(),
				edges: z.array(z.unknown()),
			}),
			pinned_channels_list_count: z.number(),
			profile_pic_url: z.string(),
			profile_pic_url_hd: z.string(),
			requested_by_viewer: z.boolean(),
			should_show_category: z.boolean(),
			should_show_public_contacts: z.boolean(),
			show_account_transparency_details: z.boolean(),
			remove_message_entrypoint: z.boolean().nullish(),
			// transparency_label: z.string().nullish(),
			// transparency_product: z.string().nullish(),
			username: z.string(),
			connected_fb_page: z.string().nullish(),
			pronouns: z.array(z.unknown()),
			edge_felix_video_timeline: z
				.object({
					count: z.number(),
					page_info: z.object({
						has_next_page: z.boolean(),
						end_cursor: z.string().nullish(),
					}),
					edges: edges_schema,
				})
				.optional(),
			edge_owner_to_timeline_media: z.object({
				count: z.number(),
				page_info: z.object({
					has_next_page: z.boolean(),
					end_cursor: z.string().nullish(),
				}),
				edges: edges_schema,
			}),
			edge_saved_media: z
				.object({
					count: z.number(),
					page_info: z.object({
						has_next_page: z.boolean(),
						end_cursor: z.string().nullish(),
					}),
					edges: edges_schema,
				})
				.optional(),
			edge_media_collections: z
				.object({
					count: z.number(),
					page_info: z.object({
						has_next_page: z.boolean(),
						end_cursor: z.string().nullish(),
					}),
					edges: edges_schema,
				})
				.optional(),
			edge_related_profiles: z
				.object({
					edges: z.array(
						z.object({
							node: z.object({
								id: z.string(),
								full_name: z.string(),
								is_private: z.boolean(),
								is_verified: z.boolean(),
								profile_pic_url: z.string(),
								username: z.string(),
							}),
						}),
					),
				})
				.optional(),
		})
		.nullish(),
});
export type WebProfile = z.infer<typeof web_profile_schema>;

const captionSchema = z.object({
	pk: z.string(),
	user_id: z.number(),
	text: z.string(),
	created_at_utc: z.number(),
	media_id: z.number(),
});

const mediaItemSchema = z.object({
	taken_at: z.number(),
	pk: z.string(),
	id: z.string(),
	code: z.string(),
	like_and_view_counts_disabled: z.boolean(),
	device_timestamp: z.number(),
	caption: captionSchema.nullish(),
	like_count: z.number(),
	play_count: z.number().optional(),
	reshare_count: z.number().nullish(),
	comment_count: z.number(),
	product_type: z.string().nullish(),
});

export const clipsSchema = z.object({
	response: z
		.object({
			num_results: z.number().nullish(),
			more_available: z.boolean().nullish(),
			items: z.array(
				z.object({
					media: mediaItemSchema,
				}),
			),
			next_max_id: z.string().optional(),
			user: z
				.object({
					pk_id: z.string(),
					username: z.string(),
				})
				.nullish(),
			auto_load_more_enabled: z.boolean().nullish(),
			status: z.string(),
		})
		.nullish(),
	next_page_id: z.string().nullish(),
});

export const mediaSchema = z.object({
	response: z
		.object({
			num_results: z.number().nullish(),
			more_available: z.boolean().nullish(),
			items: z.array(mediaItemSchema),
			next_max_id: z.string().optional(),
			user: z
				.object({
					pk_id: z.string(),
					username: z.string(),
				})
				.nullish(),
			auto_load_more_enabled: z.boolean().nullish(),
			status: z.string(),
		})
		.nullish(),
	next_page_id: z.string().nullish(),
});

export const a2Schema = z.object({
	graphql: z.object({
		user: z.object({
			id: z.string(),
			biography: z.string(),
			full_name: z.string().nullish(),
			edge_followed_by: z.object({
				count: z.number(),
			}),
			edge_follow: z.object({
				count: z.number(),
			}),
			edge_owner_to_timeline_media: z.object({
				count: z.number(),
				page_info: z
					.object({
						has_next_page: z.boolean(),
						end_cursor: z.string().nullish(),
					})
					.optional(),
				edges: z.array(
					z.object({
						node: z.object({
							id: z.string(),
							shortcode: z.string(),
							edge_media_to_comment: z.object({
								count: z.number(),
							}),
							// taken_at_timestamp: z.number(),
							edge_liked_by: z.object({
								count: z.number(),
							}),
							edge_media_preview_like: z.object({
								count: z.number(),
							}),
							// is_video: z.boolean(),
							product_type: z.string().nullish(),
							// accessibility_caption: z.string().nullish(),
							edge_media_to_caption: z.object({
								edges: z.array(
									z.object({
										node: z.object({
											text: z.string(),
										}),
									}),
								),
							}),
						}),
					}),
				),
			}),
		}),
	}),
});

export const userSchema = z.object({
	user: z.object({
		username: z.string(),
		follower_count: z.number(),
		following_count: z.number(),
		full_name: z.string().nullish(),
		biography: z.string(),
	}),
});

export const commentSchema = z.object({
	response: z
		.object({
			comment_likes_enabled: z.boolean(),
			comments: z.array(
				z.object({
					pk: z.string(),
					user_id: z.number(),
					user: z.object({
						pk: z.string(),
						pk_id: z.string(),
						id: z.string(),
						username: z.string(),
						full_name: z.string(),
						is_private: z.boolean(),
						strong_id__: z.string(),
						is_verified: z.boolean(),
						profile_pic_id: z.string().nullish(),
						profile_pic_url: z.string().nullish(),
						latest_reel_media: z.number().nullish(),
						latest_besties_reel_media: z.number().nullish(),
					}),
					type: z.number(),
					text: z.string(),
					created_at: z.number(),
					created_at_utc: z.number(),
					content_type: z.string(),
					status: z.string(),
					bit_flags: z.number(),
					share_enabled: z.boolean(),
					is_ranked_comment: z.boolean(),
					is_covered: z.boolean(),
					media_id: z.number(),
					comment_like_count: z.number(),
					like_count: z.number(),
				}),
			),
			comment_count: z.number(),
		})
		.nullish(),
	next_page_id: z.string().nullish(),
});

export const followersSchema = z.object({
	response: z.object({
		users: z
			.object({
				id: z.string(),
				full_name: z.string(),
				username: z.string(),
				is_verified: z.boolean(),
				is_private: z.boolean(),
			})
			.array(),
	}),
	next_page_id: z.string(),
});

export const followingSchema = z.object({
	response: z.object({
		users: z
			.object({
				id: z.string(),
				full_name: z.string(),
				username: z.string(),
				is_verified: z.boolean(),
				is_private: z.boolean(),
			})
			.array(),
	}),
	next_page_id: z.string(),
});

export const userByUsernameSchema = z.object({
	user: z.object({
		id: z.string(),
		username: z.string(),
		full_name: z.string().nullish(),
		biography: z.string().nullish(),
		is_verified: z.boolean(),
		is_private: z.boolean(),
		follower_count: z.number().nullish(),
		following_count: z.number().nullish(),
		media_count: z.number().nullish(),
		profile_pic_url: z.string().nullish(),
		profile_pic_url_hd: z.string().nullish(),
		external_url: z.string().nullish(),
	}),
});
