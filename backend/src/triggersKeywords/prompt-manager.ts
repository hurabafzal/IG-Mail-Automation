import { Effect } from "effect";
import type { Selectable } from "kysely";
import { Cone } from "lucide-react";
import { db } from "../db";
import {
	type Email,
	type EmailSequence,
	EmailSequenceStage,
	GeneratedEmailType,
	type InstagramAccountBase,
	type UniqueInstagramPost,
} from "../db/db_types";
import {
	downloadImagesAsBase64,
	getUniqueImageUrls,
} from "../utils/image-utils";
import { sanitizeAndTruncate, sanitizeUnicode } from "../utils/string-utils";

class PromptDataError {
	readonly _tag = "PromptDataError";
	constructor(
		public readonly message: string,
		public readonly cause?: unknown,
	) {}
}

type InstagramAccount = Selectable<InstagramAccountBase>;

interface PromptData {
	sequence: Selectable<EmailSequence>;
	account: InstagramAccount;
	posts: Selectable<UniqueInstagramPost>[];
	email?: Selectable<Email>;
	emailType: GeneratedEmailType;
	stageNumber: number;
	requestPayload: Record<string, unknown>;
}

/**
 * Enhanced context interface for OpenAI prompts
 */
interface EmailContext {
	username: string;
	country: string | "German";
	fullName: string | null;
	bio: string | null;
	post_url: string | null;
	post_description: string | null;
	first_name: string | null;
}

/**
 * Startviral pricing and performance data based on follower count
 */
interface StartviralPackage {
	followerRange: string;
	expectedFollowerGrowthMin: number;
	expectedFollowerGrowthMax: number;
	expectedStoryViewGrowthMin: number;
	expectedStoryViewGrowthMax: number;
	dailyAdBudget: number;
	monthlyAdBudget: number;
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const STR_LIT = /^'(?:[^'\\]|\\.)*'$|^"(?:[^"\\]|\\.)*$/;
const NUM_LIT = /^[+-]?\d+(?:\.\d+)?$/;
const VAR = /\$\{([^}]+)\}/g;

/**
 * Startviral product features for email templates
 */

export async function getPromptContentByType(type: string): Promise<string> {
	const prompt = await db
		.selectFrom("Prompt")
		.selectAll()
		.where("type", "=", type)
		.where("enabled", "=", true)
		.executeTakeFirst();
	// console.log(prompt);
	// Provide fallback for known types
	switch (type) {
		case "startviralFeatures":
			return prompt?.content ?? startviralFeatures_prompt;
		case "startviralBenefits":
			return prompt?.content ?? startviralBenefits_prompt;
		case "startviralGuidelines":
			return prompt?.content ?? startviralGuidelines_prompt;
		case "startviralEmailExamples":
			return prompt?.content ?? startviralEmailExamples_prompt;
		case "startviralOpenerEmailSystemPromptLanguage":
			return (
				prompt?.content ?? "startviralOpenerEmailSystemPromptLanguage_prompt"
			);
		case "startviralTriggerEmailSystemPromptLanguage":
			return (
				prompt?.content ?? "startviralTriggerEmailSystemPromptLanguage_prompt"
			);
		default:
			return prompt?.content ?? "";
	}
}

const startviralFeatures_prompt = `# Startviral Services

## Creator Growth Strategy
- Combination of high-performing content and data-driven targeting
- Selection of the most successful Reels and posts from creator's feed as ad creatives
- People who engage with ads are redirected to creator's profile for organic follow decisions
- Precise audience targeting and extensive use of retargeting data
- Years of retargeting data to show ads to users who have previously engaged with other creators in the same niche
- Increased ad relevance and significantly reduced cost per acquired follower

## Performance Advantages Over Instagram Boost
- Precisely defined target audience vs. Instagram's broad boost feature
- Full performance tracking and analytics
- Retargeting ensures active and contextually relevant followers
- Avoids inactive or irrelevant followers from unrelated regions
- Higher quality followers who are genuinely interested in the creator's content

## Proven Track Record
- Active since 2017 in Berlin
- Over 1300 creator campaigns executed
- Over 4 million followers generated through paid ads
- More than 450 active creators across Europe and the United States
- Supporting 500+ creators currently

## Comprehensive Growth Benefits
- Follower growth increases proportionally
- Story view growth increases significantly
- Likes, reel views, comments, and post saves increase proportionally
- Content reaches more engaged and relevant audiences
- Improved engagement rates leading to better brand collaboration opportunities
- Higher potential for paid partnerships due to quality audience`;

const startviralFeatures = `${await getPromptContentByType("startviralFeatures")}`;

/**
 * Startviral benefits compared to other marketing approaches
 */
const startviralBenefits_prompt = `## Advantages
- Precisely defined target audience instead of broad, unfocused promotion
- Full performance tracking and detailed analytics
- Retargeting capabilities using years of accumulated data
- Active and contextually relevant followers vs inactive followers from unrelated regions
- Data-driven targeting using audiences from similar creators in the same niche
- Significantly reduced cost per acquired follower through precise targeting

## Setup and Campaign Benefits
- Professional campaign setup and management by experienced team
- Proven method using creator's own high-performing content as ad creatives
- Organic follow decision process ensures genuine interest
- Comprehensive growth across all engagement metrics (likes, reel views, comments, saves)
- Improved engagement rates leading to better brand partnership opportunities
- Follower-count-based pricing with clear performance expectations`;
const startviralBenefits = `${await getPromptContentByType("startviralBenefits")}`;

/**
 * Email generation guidelines for Startviral outreach
 */
export const startviralGuidelines_prompt = `# Startviral Email Guidelines

## Opening Approach
- Reference follower analysis findings and growth potential
- Mention specific recent posts or content that caught attention
- Avoid generic discovery claims - be authentic about how you found them
- Use "I noticed" or "I've been analyzing" rather than "I stumbled upon"
- Compliment current content quality and mention untapped potential

## Tone and Content Guidelines
- Professional but conversational - speak as a growth expert, not a salesperson
- Provide specific performance metrics and expectations based on their follower count
- Reference proven track record (1300+ campaigns, 4M+ followers generated)
- Include concrete budget recommendations and expected results from their follower tier
- Mention the proportional growth in all engagement metrics
- Address creator economy and brand partnership opportunities
- Reference other creators in their niche having better engagement rates
- Keep the email short, around 150 words

## Technical Approach
- Explain how their best posts/reels would be used as ad creatives
- Describe the retargeting strategy using audiences from similar creators
- Differentiate from Instagram's basic boost feature
- Mention the organic follow decision process after ad engagement
- Explain the "super audience" concept containing followers of similar creators

## Call-to-Action Strategy
- Suggest a consultation to discuss their specific growth potential
- Offer to show examples from similar creators in their niche
- Propose a 30-day paid trial campaign to demonstrate effectiveness
- Mention comprehensive setup and support provided
- Reference supporting 500+ creators currently

## Follow-up Approach Variations
### Personal Approach:
- Reference previous email and visiting their profile again
- Mention irresistible content quality
- Compare to other creators in their niche (32% more engagement)
- Explain specific post selection for ad creatives
- Mention 30-day paid trial availability

### Brand Partnership Focus:
- Focus on brand deal opportunities and creator economy
- Create fictional relevant campaign examples
- Explain brands need for safe bets with outstanding engagement
- Position Startviral as the solution for brand attention
- Use "let's talk" call-to-action

### Technical Setup Focus:
- Detailed explanation of campaign setup process
- Specific post examples for ad creatives
- Target group configuration details
- Profile visit and engagement increase explanation
- Super audience and retargeting strategy details`;
export const startviralGuidelines = `${await getPromptContentByType("startviralGuidelines")}`;
/**
 * Startviral email examples that demonstrate the conversational, direct style
 */
export const startviralEmailExamples_prompt = `# Email Examples

## Example 1: Tech Creator (40k-50k followers)
<subject>44k Follower auf deinem Profil @makerlounge</subject>
<email>
Hey Stefan,

lass mich raten: Dein Instagram läuft, aber bei der Qualität und Anzahl der Kooperationen ist definitiv noch Luft nach oben, oder?

Wir haben deinen Account mit deinen rund 44000 Followern in den letzten fünf Wochen über unsere Creator-Datenbank beobachtet. Mir ist dabei aufgefallen, dass dein Engagement deutlich hinter dem von anderen Creators im Bereich Tech & Science zurückbleibt.

Hast du eine Ahnung, woran das liegen könnte? Dein Content ist eigentlich richtig stark! Das Problem ist nur, dass Brands extrem auf Dinge wie Follower-Wachstum, Story-Views und die Engagement-Rate achten.

Wir schalten seit über sieben Jahren Instagram-Ads für Creator in Deutschland, Österreich und der Schweiz – mit dem klaren Ziel, neue und vor allem hochaktive Follower zu gewinnen.

Weil wir das schon so lange machen, wissen wir genau, wie wir für einen Account in deiner Größe mit etwa 4,50 Euro pro Tag dafür sorgen, dass du monatlich ca. 750 - 1000 deutsche Follower bekommst, die wirklich mit deinem Content interagieren – also deine Storys anschauen, Reels und Posts liken und auch kommentieren. 😊

Antworte einfach kurz auf meine Mail, dann sende ich dir gerne mehr Details.

Liebe Grüße
</email>

## Example 2: Lifestyle Creator (20k-30k followers)
<subject>Kooperationsanfrage zu lifewithlaura</subject>
<email>
Hey Laura,

ich verfolge deinen Account jetzt schon seit ein paar Wochen und frage mich ehrlich: Warum hast du bei der Qualität deines Contents "nur" 23000 Follower?

Andere Lifestyle-Creators mit ähnlichem Content haben teilweise doppelt so viele Follower und vor allem deutlich mehr Story-Views. Das liegt aber nicht daran, dass dein Content schlechter wäre – ganz im Gegenteil!

Das Problem ist wahrscheinlich, dass deine Posts einfach nicht die Reichweite bekommen, die sie verdienen. Instagram zeigt deine Inhalte nur einem Bruchteil deiner Follower – und neue Leute erreichen dich kaum organisch.

Wir lösen genau dieses Problem seit 2017 für Creator wie dich. Mit gezielten Instagram-Ads sorgen wir dafür, dass deine besten Posts als Werbung ausgespielt werden – und zwar an Leute, die bereits anderen Lifestyle-Accounts folgen.

Bei deiner Follower-Größe würden wir mit 4 Euro täglich arbeiten und könnten dir monatlich etwa 500-750 neue, aktive Follower aus Deutschland bringen. Gleichzeitig steigen deine Story-Views um etwa 250-875 täglich.

Falls du Lust auf mehr Details hast, schreib mir einfach zurück!

Liebe Grüße
</email>

## Example 3: Fitness Creator (60k-70k followers)
<subject>Kooperationsanfrage für fitnesswithmax</subject>
<email>
Hey Max,

dein Content im Fitness-Bereich ist wirklich top – aber mal ehrlich: Bei 65000 Followern müsstest du längst von Brands überschüttet werden, oder?

Mir ist aufgefallen, dass deine Engagement-Rate im Vergleich zu anderen Fitness-Creators deutlich niedriger liegt. Das könnte daran liegen, dass ein Teil deiner Follower inaktiv geworden ist – ein Problem, das fast alle größeren Accounts haben.

Die Lösung? Kontinuierlich neue, wirklich aktive Follower gewinnen, die deine Storys anschauen und mit deinen Posts interagieren.

Wir machen genau das seit über sieben Jahren professionell für Creator im DACH-Raum. Deine besten Fitness-Posts werden als Instagram-Ads ausgespielt – aber nur an Leute, die bereits anderen Fitness-Accounts folgen und wirklich an dem Thema interessiert sind.

Mit 5 Euro täglich könnten wir für dich monatlich 1250-1500 neue Follower generieren, die aktiv mit deinem Content interagieren. Dazu kommen täglich 1500-2000 zusätzliche Story-Views.

Das Beste: Mehr aktive Follower bedeuten bessere Engagement-Raten, was wiederum Brands anzieht. 💪

Interesse? Dann antworte kurz auf diese Mail.

Liebe Grüße
</email>

## Example 4: Fashion Creator (15k followers)
<subject>15k Follower auf deinem Profil @stylishsarah</subject>
<email>
Hey Sarah,

ich schaue mir täglich hunderte Fashion-Accounts an, und ehrlich gesagt: Dein Stil und deine Foto-Qualität sind deutlich besser als die vieler Creator mit 50000+ Followern.

Bei deinen aktuell 15000 Followern ist definitiv noch viel Luft nach oben – vor allem, weil Fashion-Content auf Instagram extrem gut funktioniert, wenn er richtig promoted wird.

Das Problem kennen wir: Organisches Wachstum dauert ewig, und die meisten deiner Posts erreichen nur einen Bruchteil deiner Follower. Dabei hättest du das Zeug, viel größere Reichweiten zu erzielen.

Wir haben in den letzten Jahren über 200 Fashion-Creators dabei geholfen, ihre Reichweite zu vervielfachen. Das Geheimnis: Wir nutzen deine besten Outfit-Posts als Instagram-Ads und spielen sie gezielt Leuten aus, die bereits anderen Fashion-Accounts folgen.

Bei deiner Account-Größe würden 4 Euro täglich reichen, um monatlich 500-750 neue, aktive Follower zu gewinnen. Diese schauen deine Storys an, liken deine Posts und kommentieren – also genau das, was der Instagram-Algorithmus liebt.

Falls du mehr darüber erfahren möchtest, schreib mir einfach eine kurze Antwort.

Liebe Grüße
</email>

## Example 5: Food Creator (35k followers)
<subject>Kooperationsanfrage zu foodwithlulia</subject>
<email>
Hey Julia,

deine Food-Posts sind wirklich appetitlich – aber warum haben andere Food-Blogger mit ähnlichem Content doppelt so viele Follower und vor allem deutlich mehr Kooperationen?

Ich analysiere täglich Creator-Accounts und bei deinen 35000 Followern sehe ich definitiv ungenutztes Potential. Deine Fotos sind professionell, deine Rezepte kreativ – aber die Reichweite passt einfach nicht zur Qualität.

Das liegt nicht an dir, sondern am Instagram-Algorithmus. Nur ein kleiner Teil deiner Follower sieht deine Posts überhaupt, und neue Leute zu erreichen wird immer schwieriger.

Wir lösen genau dieses Problem: Deine besten Food-Posts werden als gezielte Instagram-Ads ausgespielt – aber nur an Leute, die bereits anderen Food-Accounts folgen und wirklich an Rezepten interessiert sind.

Mit 4,50 Euro täglich können wir für deinen Account monatlich 750-1000 neue, aktive Follower generieren. Das sind Leute, die deine Storys anschauen, deine Rezepte speichern und kommentieren.

Mehr aktive Follower = bessere Engagement-Rate = mehr Aufmerksamkeit von Brands. 🍽️

Interesse an den Details? Dann antworte einfach kurz.

Liebe Grüße
</email>`;
export const startviralEmailExamples = `${await getPromptContentByType("startviralEmailExamples")}`;
/**
 * 🧠 System prompt for Startviral opener email generation (with follow-ups)
 */
export const startviralOpenerEmailSystemPrompt = (
	formattedExamples: string,
) => `You are an expert email copywriter specializing in creating personalized outreach emails for Startviral, a creator growth agency based in Berlin.

# Task
Generate a complete email sequence promoting Startviral's Instagram growth services. This is the initial outreach to a creator who has never been contacted before. The email should convince creators that Startviral's data-driven approach is superior to Instagram's basic boost features and other growth methods.

You should base your emails on the creator's Instagram account data, including their follower count, recent posts, engagement, and content category. Think about their current performance and growth potential.

Include clear strategies on HOW to enhance their growth with Startviral's proven methods. Be concrete about implementation, budget recommendations, and expected results based on their follower tier.

**IMPORTANT**: If the account appears to be a business (based on category, bio, or content), avoid mentioning brand deals or creator partnerships. Instead focus on business-relevant benefits like building an active audience, marketing ROI, audience engagement, and community growth for business purposes.

DO NOT include formal closings like "Best regards" - keep it conversational with "Liebe Grüße" at the end.

# Input Format
You will receive:
1. Instagram username and account details
2. Follower count and engagement metrics
3. Recent posts and content analysis
4. Account category and niche information
5. Post images for visual context of their content style and quality

# Response Format
First, provide your analysis of the creator and their growth potential:
<thoughts>
Your analysis of the creator, their niche, current performance, and which Startviral strategies would benefit them most. Include insights about their content quality, engagement patterns, and growth opportunities. Note if this is a business account and adjust messaging accordingly.
</thoughts>

<subject>
Email subject line in German using one of these formats:
- Kooperationsanfrage zu {{username}}
- {{follower rounded}} Follower auf deinem Profil @{{username}}
- Kooperationsanfrage für {{username}}

Where {{username}} is the Instagram username without @ symbol, and {{follower rounded}} is the follower count rounded to nearest thousand (e.g., "44k", "15k", "1.2k").
</subject>

Then provide the opener email:
<email>
The complete opener email text in German, properly formatted. This should be the main pitch explaining:
- Follower analysis findings and growth potential
- Current content quality and untapped potential
- Specific performance metrics and budget recommendations
- How the Instagram ad strategy works
- Clear call-to-action
- For businesses: focus on building an active audience, marketing effectiveness, and community growth
- For creators: can include brand partnership opportunities and creator economy benefits
</email>

<follow_up_1>
First follow-up email focusing on the technical approach and system reliability:
- Reference previous email
- Emphasize legitimacy and system reliability
- Explain the technical process (using best posts as ad creatives)
- Detail the retargeting strategy using similar creator audiences
- Include specific performance expectations
- Story views and engagement growth explanation
</follow_up_1>

<follow_up_2>
Second follow-up with appropriate focus based on account type:
- Ask about lack of response
- Reference work with other accounts in their niche
- For businesses: Focus on marketing ROI, audience building, and community growth
- For creators: Focus on monetization and brand deals
- Explain how engagement affects algorithm and organic reach
- Mention active followers vs inactive ones
- Offer 30-day paid trial period
</follow_up_2>

<follow_up_3>
Final follow-up with detailed campaign setup explanation:
- Last attempt with technical details
- Explain exactly how campaign setup works
- Detail target group configuration and audience matching
- Super audience and retargeting strategy
- Profile visits, story views, and follower conversion process
- Certainty of results based on similar account data
</follow_up_3>

**IMPORTANT**: Output all XML tags flat with NO indentation. Do not indent the content inside XML tags.

# Startviral Services
<features>
${startviralFeatures}
</features>

# Benefits of Startviral
${startviralBenefits}

# Examples
${formattedExamples || startviralEmailExamples}

# Email Guidelines
<guidelines>
${startviralGuidelines}
</guidelines>

# Email Approach Variations to Include
## Opener Email Focus:
- Follower analysis and growth potential
- Content quality assessment with specific post mentions
- Performance gaps compared to similar accounts
- Budget and expected results for their follower tier
- Instagram ad strategy overview
- Account-type appropriate benefits (business vs creator focus)

## Follow-up Focuses:
### Technical Approach (Follow-up 1):
- System reliability and legitimacy
- Best posts as ad creatives process
- Retargeting using similar account audiences
- Story views and engagement conversion
- Performance metrics and tracking

### Business/Creator Focus (Follow-up 2):
- For businesses: Marketing ROI and customer acquisition focus
- For creators: Creator economy and monetization focus
- Comparison with other accounts in niche
- Algorithm benefits and organic reach
- Active vs inactive follower quality
- 30-day paid trial period offering

### Detailed Setup Process (Follow-up 3):
- Step-by-step campaign explanation
- Target audience configuration
- Super audience retargeting strategy
- Profile visit and conversion process
- Success certainty based on data
`;

//Written By Awais for Language Specified Emails
export const startviralOpenerEmailSystemPromptLanguage_Prompt = (
	formattedExamples: string,
	language = "German",
) => `You are an expert email copywriter specializing in creating personalized outreach emails for Startviral, a creator growth agency based in Berlin.

# Task
Generate a complete email sequence promoting Startviral's Instagram growth services. This is the initial outreach to a creator who has never been contacted before. The email should convince creators that Startviral's data-driven approach is superior to Instagram's basic boost features and other growth methods.

You should base your emails on the creator's Instagram account data, including their follower count, recent posts, engagement, and content category. Think about their current performance and growth potential.

Include clear strategies on HOW to enhance their growth with Startviral's proven methods. Be concrete about implementation, budget recommendations, and expected results based on their follower tier.

**IMPORTANT**: If the account appears to be a business (based on category, bio, or content), avoid mentioning brand deals or creator partnerships. Instead focus on business-relevant benefits like building an active audience, marketing ROI, audience engagement, and community growth for business purposes.

DO NOT include formal closings like "Best regards" - keep it conversational with "Liebe Grüße" at the end.

# Output Language
All emails must be written in this ${language}.
# Input Format
You will receive:
1. Instagram username and account details
2. Follower count and engagement metrics
3. Recent posts and content analysis
4. Account category and niche information
5. Post images for visual context of their content style and quality

# Response Format
First, provide your analysis of the creator and their growth potential:
<thoughts>
Your analysis of the creator, their niche, current performance, and which Startviral strategies would benefit them most. Include insights about their content quality, engagement patterns, and growth opportunities. Note if this is a business account and adjust messaging accordingly.
</thoughts>

<subject>
Email subject line in ${language} using one of these formats:
- Kooperationsanfrage zu {{username}}
- {{follower rounded}} Follower auf deinem Profil @{{username}}
- Kooperationsanfrage(n) für {{username}}

Where {{username}} is the Instagram username without @ symbol, and {{follower rounded}} is the follower count rounded to nearest thousand (e.g., "44k", "15k", "1.2k").
</subject>

Then provide the opener email:
<email>
The complete opener email text in ${language}, properly formatted. This should be the main pitch explaining:
- Follower analysis findings and growth potential
- Current content quality and untapped potential
- Specific performance metrics and budget recommendations
- How the Instagram ad strategy works
- Clear call-to-action
- For businesses: focus on building an active audience, marketing effectiveness, and community growth
- For creators: can include brand partnership opportunities and creator economy benefits
</email>

<follow_up_1>
First follow-up email in ${language} focusing on the technical approach and system reliability:
 - Reference previous email
- Emphasize legitimacy and system reliability
- Explain the technical process (using best posts as ad creatives)
- Detail the retargeting strategy using similar creator audiences
- Include specific performance expectations
- Story views and engagement growth explanation
</follow_up_1>

<follow_up_2>
Second follow-up in ${language} with appropriate focus based on account type:
- Ask about lack of response
- Reference work with other accounts in their niche
- For businesses: Focus on marketing ROI, audience building, and community growth
- For creators: Focus on monetization and brand deals
- Explain how engagement affects algorithm and organic reach
- Mention active followers vs inactive ones
- Offer 30-day paid trial period
</follow_up_2>

<follow_up_3>
Final follow-up in ${language} with detailed campaign setup explanation:
- Last attempt with technical details
- Explain exactly how campaign setup works
- Detail target group configuration and audience matching
- Super audience and retargeting strategy
- Profile visits, story views, and follower conversion process
- Certainty of results based on similar account data
</follow_up_3>

**IMPORTANT**: Output all XML tags flat with NO indentation. Do not indent the content inside XML tags.

# Startviral Services
<features>
${startviralFeatures}
</features>

# Benefits of Startviral
${startviralBenefits}

# Examples
${formattedExamples || startviralEmailExamples}

# Email Guidelines
<guidelines>
${startviralGuidelines}
</guidelines>

# Email Approach Variations to Include
## Opener Email Focus:
- Follower analysis and growth potential
- Content quality assessment with specific post mentions
- Performance gaps compared to similar accounts
- Budget and expected results for their follower tier
- Instagram ad strategy overview
- Account-type appropriate benefits (business vs creator focus)

## Follow-up Focuses:
### Technical Approach (Follow-up 1):
- System reliability and legitimacy
- Best posts as ad creatives process
- Retargeting using similar account audiences
- Story views and engagement conversion
- Performance metrics and tracking

### Business/Creator Focus (Follow-up 2):
- For businesses: Marketing ROI and customer acquisition focus
- For creators: Creator economy and monetization focus
- Comparison with other accounts in niche
- Algorithm benefits and organic reach
- Active vs inactive follower quality
- 30-day paid trial period offering

### Detailed Setup Process (Follow-up 3):
- Step-by-step campaign explanation
- Target audience configuration
- Super audience retargeting strategy
- Profile visit and conversion process
- Success certainty based on data
`;

export const startviralOpenerEmailSystemPromptLanguage = async (
	formattedExamples: string,
	language = "German",
) => {
	const template = await getPromptContentByType(
		"startviralOpenerEmailSystemPromptLanguage",
	);

	// Build whatever defaults you want always available here:
	// console.log(startviralEmailExamples,"check")
	const baseContext = {
		formattedExamples,
		language,
		startviralFeatures,
		startviralBenefits,
		startviralEmailExamples,
		startviralGuidelines,

		// nowISO: new Date().toISOString(),
		// appName: "StartViral",
		// …anything else you want globally available
	};

	return renderTemplate(template, baseContext, { missing: "throw" });
};
// eval(
// 	"`" +
// 		(await getPromptContentByType(
// 			"startviralOpenerEmailSystemPromptLanguage",
// 		)) +
// 		"`",
// );

/**
 * 🧠 System prompt for Startviral trigger email generation (single email)
 */
export const startviralTriggerEmailSystemPrompt = (
	formattedExamples: string,
) => `You are an expert email copywriter specializing in creating personalized follow-up emails for Startviral, a creator growth agency based in Berlin.

# Task
Generate a single follow-up email for a creator who has already received the initial opener sequence but didn't respond. This trigger email is based on a specific behavioral change or event detected on their Instagram account.

This is NOT the first contact - they have already been introduced to Startviral's services. Focus on the specific trigger event and how it relates to their growth needs.

You should reference the trigger event naturally and explain how Startviral can specifically help with their current situation.

**IMPORTANT**: If the account appears to be a business (based on category, bio, or content), avoid mentioning brand deals or creator partnerships. Instead focus on business-relevant benefits like building an active audience, marketing ROI, audience engagement, and community growth for business purposes.

DO NOT include formal closings like "Best regards" - keep it conversational with "Liebe Grüße" at the end.

# Input Format
You will receive:
1. Instagram username and account details
2. Trigger context (follower loss, hidden likes, etc.)
3. Specific instructions for addressing the trigger
4. Startviral package details for their follower tier
5. Post images for visual context of their content style and quality

# Response Format
<subject>
Email subject line in German using one of these formats:
- Kooperationsanfrage zu {{username}}
- {{follower rounded}} Follower auf deinem Profil @{{username}}
- Kooperationsanfrage für {{username}}

Where {{username}} is the Instagram username without @ symbol, and {{follower rounded}} is the follower count rounded to nearest thousand (e.g., "44k", "15k", "1.2k").
</subject>

<email>
The complete trigger email text in German, addressing the specific trigger event and explaining how Startviral can help with their specific situation. Should include:
- Natural reference to the trigger event
- How this relates to their growth challenges
- Specific Startviral solutions for their situation
- Technical details about campaign setup and targeting
- Clear next steps and call-to-action
- For businesses: focus on building an active audience, marketing effectiveness, and community growth
- For creators: can include brand partnership opportunities and creator economy benefits
</email>

**IMPORTANT**: Output all XML tags flat with NO indentation. Do not indent the content inside XML tags.

# Startviral Services
<features>
${startviralFeatures}
</features>

# Benefits of Startviral
${startviralBenefits}

# Examples
${formattedExamples || startviralEmailExamples}

# Email Guidelines
<guidelines>
${startviralGuidelines}
</guidelines>

# Trigger Email Approach:
- Reference the specific behavioral change/event naturally
- Connect the trigger to broader growth challenges
- Provide detailed technical explanation of how Startviral addresses their specific situation
- Include concrete campaign setup details and retargeting strategy
- Emphasize timing and opportunity
- Strong call-to-action with specific next steps
- Tailor benefits to account type (business vs creator focus)
`;
export const startviralTriggerEmailSystemPromptLanguage_Prompt = (
	formattedExamples: string,
	language = "German",
) => `You are an expert email copywriter specializing in creating personalized follow-up emails for Startviral, a creator growth agency based in Berlin.

# Task
Generate a single follow-up email for a creator who has already received the initial opener sequence but didn't respond. This trigger email is based on a specific behavioral change or event detected on their Instagram account.

This is NOT the first contact - they have already been introduced to Startviral's services. Focus on the specific trigger event and how it relates to their growth needs.

You should reference the trigger event naturally and explain how Startviral can specifically help with their current situation.

**IMPORTANT**: If the account appears to be a business (based on category, bio, or content), avoid mentioning brand deals or creator partnerships. Instead focus on business-relevant benefits like building an active audience, marketing ROI, audience engagement, and community growth for business purposes.

DO NOT include formal closings like "Best regards" - keep it conversational with "Liebe Grüße" at the end.

# Output Language
Write the entire response in ${language}.

# Input Format
You will receive:
1. Instagram username and account details
2. Trigger context (follower loss, hidden likes, etc.)
3. Specific instructions for addressing the trigger
4. Startviral package details for their follower tier
5. Post images for visual context of their content style and quality

# Response Format
<subject>
Email subject line in ${language} using one of these formats:
- Kooperationsanfrage zu {{username}}
- {{follower rounded}} Follower auf deinem Profil @{{username}}
- Kooperationsanfrage für {{username}}

Where {{username}} is the Instagram username without @ symbol, and {{follower rounded}} is the follower count rounded to nearest thousand (e.g., "44k", "15k", "1.2k").
</subject>

<email>
The complete trigger email text in ${language}, addressing the specific trigger event and explaining how Startviral can help with their specific situation. Should include:
- Natural reference to the trigger event
- How this relates to their growth challenges
- Specific Startviral solutions for their situation
- Technical details about campaign setup and targeting
- Clear next steps and call-to-action
- For businesses: focus on building an active audience, marketing effectiveness, and community growth
- For creators: can include brand partnership opportunities and creator economy benefits
</email>

**IMPORTANT**: Output all XML tags flat with NO indentation. Do not indent the content inside XML tags.

# Startviral Services
<features>
${startviralFeatures}
</features>

# Benefits of Startviral
${startviralBenefits}

# Examples
${formattedExamples || startviralEmailExamples}

# Email Guidelines
<guidelines>
${startviralGuidelines}
</guidelines>

# Trigger Email Approach:
- Reference the specific behavioral change/event naturally
- Connect the trigger to broader growth challenges
- Provide detailed technical explanation of how Startviral addresses their specific situation
- Include concrete campaign setup details and retargeting strategy
- Emphasize timing and opportunity
- Strong call-to-action with specific next steps
- Tailor benefits to account type (business vs creator focus)
`;

// export const startviralTriggerEmailSystemPromptLanguage = async (
// 	formattedExamples: string,
// 	language = "German",
// ) =>
// 	eval(
// 		"`" +
// 			(await getPromptContentByType(
// 				"startviralTriggerEmailSystemPromptLanguage",
// 			)) +
// 			"`",
// 	);

function getFrom(ctx: Record<string, unknown>, path: string) {
	const parts = path.split(".");
	let cur: unknown = ctx;
	for (const key of parts) {
		if (
			cur === null ||
			typeof cur !== "object" ||
			!Object.prototype.hasOwnProperty.call(cur as object, key)
		) {
			return undefined;
		}
		cur = (cur as Record<string, unknown>)[key];
	}
	return cur;
}

function parseStringLiteral(raw: string) {
	// support both 'single' and "double" quoted strings
	if (!STR_LIT.test(raw)) return undefined;
	const quote = raw[0];
	const inner = raw.slice(1, -1);
	// very small unescape for \" and \'
	return inner
		.replace(new RegExp(`\\\\${quote}`, "g"), quote)
		.replace(/\\n/g, "\n");
}

function evalTerm(term: string, ctx: Record<string, unknown>) {
	if (IDENT.test(term)) return getFrom(ctx, term);
	if (STR_LIT.test(term)) return parseStringLiteral(term);
	if (NUM_LIT.test(term)) return Number(term);
	if (term === "true") return true;
	if (term === "false") return false;
	if (term === "null") return null;
	if (term === "undefined") return undefined;
	throw new Error(`Illegal expression in template: ${term}`);
}

// Allowed grammar: <term> ( ( "||" | "??" ) <term> )*
function evaluateExpr(expr: string, ctx: Record<string, unknown>) {
	const tokens = expr
		.split(/(\|\||\?\?)/)
		.map((t) => t.trim())
		.filter(Boolean);
	if (tokens.length === 0) return "";
	let value = evalTerm(tokens[0], ctx);
	for (let i = 1; i < tokens.length; i += 2) {
		const op = tokens[i];
		const rhs = evalTerm(tokens[i + 1], ctx);
		if (op === "??") {
			value = value ?? rhs; // only null/undefined fallback
		} else if (op === "||") {
			// JS truthiness fallback (empty string/0/false will fallback)
			value = value || rhs;
		} else {
			throw new Error(`Illegal operator in template: ${op}`);
		}
	}
	return value;
}

function renderTemplate(
	template: string,
	context: Record<string, unknown>,
	opts: { missing?: "throw" | "empty" | "leave" } = { missing: "throw" },
): string {
	return template.replace(VAR, (_m, raw) => {
		const expr = String(raw).trim();

		// Quick guard: only allow identifiers, dots, quotes, numbers, spaces, and the operators
		if (
			!/^[\w.$\s'"+-?|\u0600-\u06FF-]+$/.test(expr) ||
			/[^\s](?:[=;`]|>>|<<)/.test(expr)
		) {
			if (opts.missing === "leave") return `\${${raw}}`;
			if (opts.missing === "empty") return "";
			throw new Error(`Illegal expression in template: ${expr}`);
		}

		const val = evaluateExpr(expr, context);
		if (val === undefined || val === null) {
			if (opts.missing === "leave") return `\${${raw}}`;
			if (opts.missing === "empty") return "";
			throw new Error(`Missing value for ${expr}`);
		}
		return String(val);
	});
}
export const startviralTriggerEmailSystemPromptLanguage = async (
	formattedExamples: string,
	language = "German",
): Promise<string> => {
	const template = await getPromptContentByType(
		"startviralTriggerEmailSystemPromptLanguage",
	);

	// Build whatever defaults you want always available here:
	// console.log(startviralEmailExamples,"check")
	const baseContext = {
		formattedExamples,
		language,
		startviralFeatures,
		startviralBenefits,
		startviralEmailExamples,
		startviralGuidelines,

		// nowISO: new Date().toISOString(),
		// appName: "StartViral",
		// …anything else you want globally available
	};

	return renderTemplate(template, baseContext, { missing: "throw" });
};
/**
 * Gets Startviral package details based on follower count
 */
function getStartviralPackage(followersCount: number): StartviralPackage {
	if (followersCount < 10000) {
		return {
			followerRange: "0 to 9999",
			expectedFollowerGrowthMin: 500,
			expectedFollowerGrowthMax: 750,
			expectedStoryViewGrowthMin: 250,
			expectedStoryViewGrowthMax: 875,
			dailyAdBudget: 4,
			monthlyAdBudget: 130,
		};
	}
	if (followersCount < 20000) {
		return {
			followerRange: "10000 to 19999",
			expectedFollowerGrowthMin: 500,
			expectedFollowerGrowthMax: 750,
			expectedStoryViewGrowthMin: 250,
			expectedStoryViewGrowthMax: 875,
			dailyAdBudget: 4,
			monthlyAdBudget: 130,
		};
	}
	if (followersCount < 30000) {
		return {
			followerRange: "20000 to 29999",
			expectedFollowerGrowthMin: 500,
			expectedFollowerGrowthMax: 750,
			expectedStoryViewGrowthMin: 500,
			expectedStoryViewGrowthMax: 1000,
			dailyAdBudget: 4,
			monthlyAdBudget: 130,
		};
	}
	if (followersCount < 40000) {
		return {
			followerRange: "30000 to 39999",
			expectedFollowerGrowthMin: 750,
			expectedFollowerGrowthMax: 1000,
			expectedStoryViewGrowthMin: 750,
			expectedStoryViewGrowthMax: 1250,
			dailyAdBudget: 4.5,
			monthlyAdBudget: 140,
		};
	}
	if (followersCount < 50000) {
		return {
			followerRange: "40000 to 49999",
			expectedFollowerGrowthMin: 750,
			expectedFollowerGrowthMax: 1000,
			expectedStoryViewGrowthMin: 1000,
			expectedStoryViewGrowthMax: 1500,
			dailyAdBudget: 4.5,
			monthlyAdBudget: 140,
		};
	}
	if (followersCount < 60000) {
		return {
			followerRange: "50000 to 59999",
			expectedFollowerGrowthMin: 1250,
			expectedFollowerGrowthMax: 1500,
			expectedStoryViewGrowthMin: 1250,
			expectedStoryViewGrowthMax: 1750,
			dailyAdBudget: 5,
			monthlyAdBudget: 150,
		};
	}
	if (followersCount < 70000) {
		return {
			followerRange: "60000 to 69999",
			expectedFollowerGrowthMin: 1250,
			expectedFollowerGrowthMax: 1500,
			expectedStoryViewGrowthMin: 1500,
			expectedStoryViewGrowthMax: 2000,
			dailyAdBudget: 5,
			monthlyAdBudget: 150,
		};
	}
	if (followersCount < 80000) {
		return {
			followerRange: "70000 to 79999",
			expectedFollowerGrowthMin: 1500,
			expectedFollowerGrowthMax: 1750,
			expectedStoryViewGrowthMin: 1500,
			expectedStoryViewGrowthMax: 2000,
			dailyAdBudget: 5.5,
			monthlyAdBudget: 150,
		};
	}
	if (followersCount < 90000) {
		return {
			followerRange: "80000 to 89999",
			expectedFollowerGrowthMin: 1500,
			expectedFollowerGrowthMax: 1750,
			expectedStoryViewGrowthMin: 1500,
			expectedStoryViewGrowthMax: 2000,
			dailyAdBudget: 6,
			monthlyAdBudget: 170,
		};
	}
	if (followersCount < 100000) {
		return {
			followerRange: "90000 to 99999",
			expectedFollowerGrowthMin: 1750,
			expectedFollowerGrowthMax: 2000,
			expectedStoryViewGrowthMin: 1750,
			expectedStoryViewGrowthMax: 2250,
			dailyAdBudget: 6.5,
			monthlyAdBudget: 170,
		};
	}

	// 100k and above
	return {
		followerRange: "100000 and above",
		expectedFollowerGrowthMin: 2000,
		expectedFollowerGrowthMax: 2500,
		expectedStoryViewGrowthMin: 2500,
		expectedStoryViewGrowthMax: 3000,
		dailyAdBudget: 7,
		monthlyAdBudget: 190,
	};
}

/**
 * Gets the Language
 */
export const getMainLanguageByCountry = (country: string | number) => {
	const countryLanguageMap = {
		Afghanistan: "Pashto",
		Albania: "Albanian",
		Algeria: "Arabic",
		Argentina: "Spanish",
		Armenia: "Armenian",
		Australia: "English",
		Austria: "German",
		Azerbaijan: "Azerbaijani",
		Bangladesh: "Bengali",
		Belarus: "Belarusian",
		Belgium: "Dutch", // also French, German
		Bolivia: "Spanish",
		Bosnia: "Bosnian",
		Brazil: "Portuguese",
		Bulgaria: "Bulgarian",
		Cambodia: "Khmer",
		Cameroon: "French",
		Canada: "English", // also French
		Chile: "Spanish",
		China: "Chinese",
		Colombia: "Spanish",
		"Costa Rica": "Spanish",
		Croatia: "Croatian",
		Cuba: "Spanish",
		Cyprus: "Greek",
		Czechia: "Czech",
		Denmark: "Danish",
		"Dominican Republic": "Spanish",
		Ecuador: "Spanish",
		Egypt: "Arabic",
		"El Salvador": "Spanish",
		Estonia: "Estonian",
		Ethiopia: "Amharic",
		Finland: "Finnish",
		France: "French",
		Georgia: "Georgian",
		Germany: "German",
		Ghana: "English",
		Greece: "Greek",
		Guatemala: "Spanish",
		Haiti: "Haitian Creole",
		Honduras: "Spanish",
		Hungary: "Hungarian",
		Iceland: "Icelandic",
		India: "Hindi",
		Indonesia: "Indonesian",
		Iran: "Persian",
		Iraq: "Arabic",
		Ireland: "English",
		Israel: "Hebrew",
		Italy: "Italian",
		"Ivory Coast": "French",
		Jamaica: "English",
		Japan: "Japanese",
		Jordan: "Arabic",
		Kazakhstan: "Kazakh",
		Kenya: "Swahili",
		Kuwait: "Arabic",
		Kyrgyzstan: "Kyrgyz",
		Laos: "Lao",
		Latvia: "Latvian",
		Lebanon: "Arabic",
		Libya: "Arabic",
		Lithuania: "Lithuanian",
		Luxembourg: "Luxembourgish",
		Madagascar: "Malagasy",
		Malaysia: "Malay",
		Mali: "French",
		Malta: "Maltese",
		Mexico: "Spanish",
		Moldova: "Romanian",
		Mongolia: "Mongolian",
		Montenegro: "Montenegrin",
		Morocco: "Arabic",
		Myanmar: "Burmese",
		Nepal: "Nepali",
		Netherlands: "Dutch",
		"New Zealand": "English",
		Nicaragua: "Spanish",
		Nigeria: "English",
		"North Korea": "Korean",
		"North Macedonia": "Macedonian",
		Norway: "Norwegian",
		Oman: "Arabic",
		Pakistan: "Urdu",
		Panama: "Spanish",
		Paraguay: "Spanish",
		Peru: "Spanish",
		Philippines: "Filipino",
		Poland: "Polish",
		Portugal: "Portuguese",
		Qatar: "Arabic",
		Romania: "Romanian",
		Russia: "Russian",
		Rwanda: "Kinyarwanda",
		"Saudi Arabia": "Arabic",
		Senegal: "French",
		Serbia: "Serbian",
		Singapore: "English",
		Slovakia: "Slovak",
		Slovenia: "Slovene",
		Somalia: "Somali",
		"South Africa": "English",
		"South Korea": "Korean",
		Spain: "Spanish",
		"Sri Lanka": "Sinhala",
		Sudan: "Arabic",
		Sweden: "Swedish",
		Switzerland: "German",
		Syria: "Arabic",
		Taiwan: "Chinese",
		Tajikistan: "Tajik",
		Tanzania: "Swahili",
		Thailand: "Thai",
		Tunisia: "Arabic",
		Turkey: "Turkish",
		Turkmenistan: "Turkmen",
		Uganda: "Swahili",
		Ukraine: "Ukrainian",
		"United Arab Emirates": "Arabic",
		"United Kingdom": "English",
		"United States": "English",
		Uruguay: "Spanish",
		Uzbekistan: "Uzbek",
		Venezuela: "Spanish",
		Vietnam: "Vietnamese",
		Yemen: "Arabic",
		Zambia: "English",
		Zimbabwe: "English",
	};

	return (
		countryLanguageMap[country as keyof typeof countryLanguageMap] || "German"
	); // fallback
};

/**
 * Gets the most engaging recent post for ad creative suggestion
 */
function getMostEngagingPost(posts: Selectable<UniqueInstagramPost>[]) {
	if (posts.length === 0) return null;

	// Sort by engagement rate (likes + comments relative to follower count could be calculated here)
	// For now, just use total engagement as a proxy
	return (
		posts
			.filter((post) => post.caption && post.caption.length > 10) // Filter out posts without meaningful captions
			.sort((a, b) => {
				const engagementA = (a.like_count || 0) + (a.comment_count * 3 || 0);
				const engagementB = (b.like_count || 0) + (b.comment_count * 3 || 0);
				return engagementB - engagementA;
			})[0] || posts[0]
	);
}

/**
 * Checks if Instagram account data is fresh enough for email generation
 * Data should be less than 30 days old
 */
function isAccountDataFresh(
	account: InstagramAccount,
	_isTriggerEmail = false,
): boolean {
	if (!account.last_data_refreshed_at) {
		return false;
	}

	const now = new Date();
	const lastRefreshed = new Date(account.last_data_refreshed_at);
	const hoursOld = (now.getTime() - lastRefreshed.getTime()) / (1000 * 60 * 60);

	const maxAge = 30 * 24; // 30 days in hours
	return hoursOld <= maxAge;
}

/**
 * Gets the email type and stage number from sequence stage and stage number
 */
function getEmailTypeFromSequence(sequence: Selectable<EmailSequence>) {
	const stageNumber = sequence.current_stage_number;

	switch (sequence.current_stage) {
		case EmailSequenceStage.OPENER_PENDING_GENERATION:
			return {
				emailType: GeneratedEmailType.OPENER,
				stageNumber,
			};
		case EmailSequenceStage.TRIGGER_EMAIL_PENDING_GENERATION:
			// TODO: Default to hidden likes trigger - this would be determined by trigger evaluation
			// In a real implementation, this would check the actual trigger that fired
			return {
				emailType: GeneratedEmailType.TRIGGER_HIDDEN_LIKES,
				stageNumber,
			};
		default:
			throw new Error(
				`Invalid stage for email generation: ${sequence.current_stage}`,
			);
	}
}
function capitalizeName(name: string | null | undefined): string {
	if (!name) return "";
	return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
/**
 * Builds OpenAI request payload from Instagram account data with Startviral-specific templates
 */

type TriggerTaskRow = {
	id: number;
	post_url?: string | null;
	post_text?: string | null;
};

type ExtraTables = {
	TriggerTask: TriggerTaskRow;
};
import type { Kysely } from "kysely";
// import { z } from "zod";
import { db as baseDb } from "../db";
function buildOpenAIRequestPayload(
	account: InstagramAccount,
	posts: Selectable<UniqueInstagramPost>[],
	emailType: GeneratedEmailType,
	email?: Selectable<Email>,
	stage?: number,
): Effect.Effect<Record<string, unknown>, never> {
	return Effect.gen(function* () {
		const isOpener = emailType === GeneratedEmailType.OPENER;

		const db = baseDb as unknown as Kysely<ExtraTables>;

		// Fetch triggerTask if stage is provided, but never fail the whole effect on DB errors
		const triggerTask: TriggerTaskRow | undefined = yield* Effect.suspend(
			() => {
				if (stage === undefined) {
					return Effect.succeed<TriggerTaskRow | undefined>(undefined);
				}
				return (
					db
						.selectFrom("TriggerTask")
						.select(["id", "post_text", "post_url"])
						.where("id", "=", stage)
						.executeTakeFirstE()
						// convert DBError -> success(undefined) so error channel becomes never
						.pipe(
							Effect.catchAll((e) =>
								// log and continue; adjust logging to your Effect logger if you prefer
								Effect.sync(() => {
									console.error("DB error fetching TriggerTask", e);
									return undefined as TriggerTaskRow | undefined;
								}),
							),
						)
				);
			},
		);

		const baseContext: EmailContext = {
			username: account.username,
			country: account.country ?? "Germany",
			fullName: sanitizeAndTruncate(account.ig_full_name, 200),
			bio: sanitizeAndTruncate(account.bio, 500),
			post_url: triggerTask?.post_url || "",
			post_description: triggerTask?.post_text || "",
			first_name: capitalizeName(account.first_name || account.ig_full_name),
		};

		if (isOpener) {
			// If you want to guarantee never-fail here as well, catch promise rejection:
			return yield* Effect.promise(() =>
				buildOpenerEmailPayload(baseContext),
			).pipe(
				// remove this catch if you prefer failures to crash the fiber instead
				Effect.catchAll((err) =>
					Effect.sync(() => {
						console.error("buildOpenerEmailPayload failed:", err);
						// Return an empty object or some safe fallback structure
						return {} as Record<string, unknown>;
					}),
				),
			);
		}

		// If you later add trigger flows, ensure they also keep the error channel as `never`
		// by catching/mapping errors similarly.
		// return buildTriggerEmailPayload(baseContext, emailType);

		throw new Error(`Unknown email type: ${emailType}`);
	});
}

// function buildOpenAIRequestPayload(
// 	account: InstagramAccount,
// 	posts: Selectable<UniqueInstagramPost>[],
// 	emailType: GeneratedEmailType,
// 	email?: Selectable<Email>,
// 	stage?: number,
// ): Effect.Effect<Record<string, unknown>, never> {
// 	return Effect.gen(function* () {
// 		// Get recent posts (last 10)
// 		// const recentPosts = posts
// 		// 	.sort(
// 		// 		(a, b) =>
// 		// 			new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime(),
// 		// 	)
// 		// 	.slice(0, 10);

// 		const isOpener = emailType === GeneratedEmailType.OPENER;
// 		// const isTrigger = emailType !== GeneratedEmailType.OPENER;

// 		// Get Startviral package information
// 		// const startviralPackage = getStartviralPackage(account.followers_count);
// 		// const mostEngagingPost = getMostEngagingPost(recentPosts);

// 		// Collect all image URLs that need downloading
// 		// const imageUrls: (string | null | undefined)[] = [];

// 		// if (mostEngagingPost?.thumbnail) {
// 		// 	imageUrls.push(mostEngagingPost.thumbnail);
// 		// }

// 		// // Add recent posts images (first 5 for analysis)
// 		// for (const post of recentPosts.slice(0, 5)) {
// 		// 	if (post.thumbnail) {
// 		// 		imageUrls.push(post.thumbnail);
// 		// 	}
// 		// }

// 		// Download all images as base64 (handle errors gracefully)
// 		// const uniqueUrls = getUniqueImageUrls(imageUrls);
// 		// const imageResults = yield* Effect.either(
// 		// 	downloadImagesAsBase64(uniqueUrls),
// 		// );

// 		// Create a map for quick lookup of base64 data by URL (only successful downloads)
// 		// const imageMap = new Map<string, string>();
// 		// if (imageResults._tag === "Right") {
// 		// 	for (const result of imageResults.right) {
// 		// 		if (result.base64) {
// 		// 			imageMap.set(result.url, result.base64);
// 		// 		}
// 		// 	}
// 		// 	console.log(
// 		// 		`✓ Successfully downloaded ${imageMap.size}/${uniqueUrls.length} images`,
// 		// 	);
// 		// } else {
// 		// 	console.log("⚠️ Image download failed, proceeding without images");
// 		// }
// 		const db = baseDb as unknown as Kysely<ExtraTables>;
// 		//
// 		let triggerTask: TriggerTaskRow | undefined = undefined;
// 		if (stage !== undefined) {
// 			triggerTask = yield* db
// 				.selectFrom("TriggerTask")
// 				.select(["id", "post_text", "post_url"])
// 				.where("id", "=", stage)
// 				.executeTakeFirstE();
// 		}

// 		const baseContext: EmailContext = {
// 			username: account.username,
// 			country: account.country ?? "Germany", // Default to German if no country specified
// 			fullName: sanitizeAndTruncate(account.ig_full_name, 200),
// 			bio: sanitizeAndTruncate(account.bio, 500),
// 			post_url: triggerTask?.post_url || "",
// 			post_description: triggerTask?.post_text || "",
// 			first_name: capitalizeName(
// 				account.first_name || account.ig_full_name || account.username,
// 			),
// 		};

// 		if (isOpener) {
// 			return yield* Effect.promise(() => buildOpenerEmailPayload(baseContext));
// 		}

// 		// if (isTrigger) {
// 		// 	return buildTriggerEmailPayload(baseContext, emailType);
// 		// }

// 		throw new Error(`Unknown email type: ${emailType}`);
// 	});

// }
/**
 * Builds OpenAI payload for opener emails with Startviral templates
 */

// async function buildOpenerEmailPayload(
// 	context: EmailContext,
// ): Promise<Record<string, unknown>> {
// 	console.log(context.country, "country for email generation");
// 	const language = getMainLanguageByCountry(context.country);
// 	console.log(language, "Language for email generation");
// 	console.log("startviralFeatures", startviralFeatures);

// 	const systemPrompt = `You are an expert outreach copywriter for Startviral, a Berlin-based creator growth agency. Your job is to generate exactly two emails for a giveaway repost permission outreach: an opener and a single follow-up.

// Context & Goal

// We find Instagram posts that include giveaway-related keywords and ask for permission to repost their giveaway on @startviral.

// The benefit for the creator/business: because our audience is highly interested in contests, reposted giveaways typically result in 200–300 new followers per repost. For especially attractive prizes, numbers can be higher.

// No emojis. Keep tone friendly, short, and conversational. Keep language to ${language} (default: German).

// Only two emails: 1) opener, 2) follow-up. No extra emails.

// Keyword Rules

// Valid keyword list (match if any keyword appears in the detected post’s description or caption, case-insensitive):
// gewinnspiel,giveaway,gewinne,verlosung,teilnahmebedingungen,raffle,gewinnchance,gewinnspielbedingungen,gewinnchance,verlosen,auslosung

// Blacklist (if any appear, do not proceed):
// advent,adventskalender

// If multiple qualifying posts from the same account are provided upstream, assume we contact them once and reference the single best/most recent detected post.

// Inputs (you will receive via the user message)

// first_name (string)

// post_url (string)

// post_description (string)

// Optional: username (string, without @)

// Writing Rules

// Subject: Giveaway {{giveaway_short_description}} where {{giveaway_short_description}} is a max 4-word summary of the giveaway derived from post_description (e.g., “iPhone 15 Pro”, “Wellness-Paket”, “Restaurant-Gutschein”).

// Opener (Email 1):

// 90–140 words.

// Mention the giveaway briefly and reference post_url.

// Ask for permission to repost on @startviral.

// Clearly state the benefit: creators/businesses typically gain 200–300 followers per repost; note that for very attractive prizes results can be higher.

// One simple call-to-action (reply “OK” or short confirmation).

// No emojis. Keep it casual, no hard sell, no formal sign-off—just a simple name line like “— Nils, Startviral”.

// Follow-up (Email 2):

// Maximum 3 sentences.

// Reference that you wrote earlier about that same post and include post_url again.

// Ask if they saw the message and if you can go ahead with the repost.

// Re-state the value very briefly (e.g., “typisch 200–300 neue Follower pro Repost”).

// No emojis. Close simply (e.g., “— Nils”).

// Output Format (XML, flat, no indentation)

// Return only these tags in this order:
// <subject>…</subject>
// <email>…</email>
// <follow_up>…</follow_up>

// Do not include any other tags (no thoughts, no features, etc.). Do not indent inside tags.

// If the blacklist matches, output an empty string in all three tags.`

// 	// Build the user message content with text and images
// 	const userContent: Array<{
// 		type: string;
// 		text?: string;
// 		image_url?: { url: string; detail: string };
// 	}> = [
// 		{
// 			type: "text",
// 			text: `Generate a complete Startviral email sequence for Instagram creator @${
// 				context.username
// 			}.

// Account details:
// - Username: @${context.username}
// - Full name: ${context.fullName || "Not provided"}
// - Followers: ${context.followersCount?.toLocaleString() || "Unknown"}
// - Following: ${context.followingCount?.toLocaleString() || "Unknown"}
// - Bio: ${context.bio || "No bio provided"}
// - Category: ${context.category || "Not specified"}
// - Verified: ${context.isVerified ? "Yes" : "No"}
// - Posts count: ${context.postsCount?.toLocaleString() || "Unknown"}

// Startviral package for their follower count (${context.followersCount || 0}):
// - Follower range: ${context.startviralPackage.followerRange}
// - Daily ad budget: €${context.startviralPackage.dailyAdBudget}
// - Monthly ad budget: €${context.startviralPackage.monthlyAdBudget}
// - Expected follower growth: ${
// 				context.startviralPackage.expectedFollowerGrowthMin
// 			}-${context.startviralPackage.expectedFollowerGrowthMax} per month
// - Expected story view growth: ${
// 				context.startviralPackage.expectedStoryViewGrowthMin
// 			}-${context.startviralPackage.expectedStoryViewGrowthMax} per day

// ${
// 	context.mostEngagingPost
// 		? `Most engaging recent post:
// - Caption: ${sanitizeUnicode(context.mostEngagingPost.caption) || "No caption"}
// - Engagement: ${context.mostEngagingPost.likeCount} likes, ${
// 				context.mostEngagingPost.commentCount
// 			} comments`
// 		: "No recent posts with significant engagement found"
// }

// Recent posts analysis:
// ${
// 	context.recentPosts.length > 0
// 		? context.recentPosts
// 				.map(
// 					(p, i) =>
// 						`${i + 1}. ${
// 							sanitizeUnicode(p.caption?.substring(0, 100)) || "No caption"
// 						}...`,
// 				)
// 				.join("\n")
// 		: "No recent posts available for analysis"
// }

// Generate the complete sequence with thoughts, subject, opener email, and all three follow-ups in XML format.`,
// 		},
// 	];

// 	// Add most engaging post image only if base64 is available
// 	if (context.mostEngagingPost?.thumbnailBase64) {
// 		userContent.push({
// 			type: "image_url",
// 			image_url: {
// 				url: context.mostEngagingPost.thumbnailBase64,
// 				detail: "low",
// 			},
// 		});
// 	}

// 	// Add recent post images only if base64 is available
// 	const recentPostsWithBase64Images = context.recentPosts.slice(0, 5);
// 	for (const post of recentPostsWithBase64Images) {
// 		if (!post.thumbnailBase64) continue;

// 		userContent.push({
// 			type: "image_url",
// 			image_url: {
// 				url: post.thumbnailBase64,
// 				detail: "low",
// 			},
// 		});
// 	}

// 	return {
// 		model: "gpt-4.1",
// 		messages: [
// 			{
// 				role: "system",
// 				content: systemPrompt,
// 			},
// 			{
// 				role: "user",
// 				content: userContent,
// 			},
// 		],
// 		max_tokens: 2000,
// 	};
// }
async function buildOpenerEmailPayload(
	context: EmailContext,
): Promise<Record<string, unknown>> {
	console.log(context.country, "country for email generation");
	const language = getMainLanguageByCountry(context.country);
	console.log(language, "Language for email generation");

	const systemPrompt = `You are an expert outreach copywriter for Startviral, a Berlin-based creator growth agency. Your job is to generate exactly two emails for a giveaway repost permission outreach: an opener and a single follow-up.

Context & Goal
We find Instagram posts that include giveaway-related keywords and ask for permission to repost their giveaway on @startviral.
The benefit for the creator/business: because our audience is highly interested in contests, reposted giveaways typically result in 200–300 new followers per repost. For especially attractive prizes, numbers can be higher.
Our goal with the Startviral Instagram account is to build the biggest giveaway community in Germany where followers are informed about the latest creator giveaways.
Important: this reposting comes at no cost and with no downside. In the repost, we clearly mention the original creator and link directly to the original post, so that all traffic, engagement, and new followers go straight to the original creator.

No emojis. Keep tone friendly, short, and conversational. Keep language to ${language} (default: German).
Only two emails: 1) opener, 2) follow-up. No extra emails.
Please make sure the first name is in proper format: the first letter capitalized and the rest in lowercase.
Do not include a signature or name line at the end of the email, since the signature is already set up in Instantly.

Keyword Rules
Valid keyword list (match if any keyword appears in the detected post’s description or caption, case-insensitive):
gewinnspiel,giveaway,gewinne,verlosung,teilnahmebedingungen,raffle,gewinnchance,gewinnspielbedingungen,gewinnchance,verlosen,auslosung
Blacklist (if any appear, do not proceed):
advent,adventskalender
If multiple qualifying posts from the same account are provided upstream, assume we contact them once and reference the single best/most recent detected post.

Inputs (you will receive via the user message)
first_name (string)
post_url (string)
post_description (string)
Optional: username (string, without @)

Writing Rules
Subject: Giveaway {{giveaway_short_description}} where {{giveaway_short_description}} is a max 4-word summary of the giveaway derived from post_description (e.g., “iPhone 15 Pro”, “Wellness-Paket”, “Restaurant-Gutschein”).

Opener (Email 1):

90–140 words.

Mention the giveaway briefly and reference post_url.

Ask for permission to repost on @startviral.

Clearly state the benefit: creators/businesses typically gain 200–300 followers per repost; note that for very attractive prizes results can be higher.

Add sentence about our goal (biggest German giveaway community, where followers see the latest giveaways).

Add sentence that reposting comes at no cost and no downside, and that the repost links directly to the original post and creator so that engagement and followers go there.

One simple call-to-action (reply “OK” or short confirmation).

No emojis. Keep it casual, no hard sell, no formal sign-off, no signature.

Follow-up (Email 2):

Maximum 3-5 sentences.

Reference that you wrote earlier about that same post and include post_url again.

Say clearly that you’re just checking if they saw the first message.

Ask if it’s okay to go ahead with the repost.

Re-state the value very briefly (e.g., “typisch 200–300 neue Follower pro Repost”).

Mention again that reposting comes at no cost or downside, traffic goes to the original creator and post.

Mention again our goal (building the biggest giveaway community in Germany where followers see the latest giveaways).

No emojis. Close simply, no signature.
For the firstname, ensure the first letter is capitalized and the rest are lowercase..

Style example:
“Hey {{firstname}}, ich hatte dir bereits wegen deines Posts geschrieben: {{post_url}}. Wollte nur kurz nachfragen, ob du meine Nachricht gesehen hast. Dürfen wir das Gewinnspiel auf @startviral reposten? Typisch bringt das 200–300 neue Follower pro Repost. Das Ganze ist komplett kostenlos, wir verlinken dich im Post direkt, damit das Engagement und die Follower bei dir ankommen. Unser Ziel ist es, die größte Gewinnspiel-Community in Deutschland aufzubauen. ”

Output Format (XML, flat, no indentation)
Return only these tags in this order:
<subject>…</subject>
<email>…</email>
<follow_up>…</follow_up>
Do not include any other tags (no thoughts, no features, etc.). Do not indent inside tags.

If the blacklist matches, output an empty string in all three tags.`;

	// Fallbacks (derive the minimal inputs this prompt needs)
	const firstName =
		context.fullName?.trim().split(/\s+/)[0] ||
		(context.username ? context.username.replace(/^@/, "") : "da");

	const postUrl = context.post_url;

	const postDescription = context.post_description;

	const username = context.username
		? context.username.replace(/^@/, "")
		: "unknown";

	// Build the (very small) user message the new system prompt expects
	const userContent: Array<{
		type: string;
		text?: string;
		image_url?: { url: string; detail: string };
	}> = [
		{
			type: "text",
			text: `Create a two-message giveaway outreach in ${language} using the rules from the system prompt.

Inputs:
- first_name: ${firstName}
- post_url: ${postUrl}
- post_description: ${sanitizeUnicode(postDescription)}
- username: ${username}

Return only the required XML tags.`,
		},
	];
	// console.log(userContent,"userContent for email generation");
	// console.log(systemPrompt, "systemPrompt for email generation");
	return {
		model: "gpt-4.1",
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userContent },
		],
		max_tokens: 2000,
	};
}
/**
 * Builds OpenAI payload for trigger emails with Startviral context
 */

/**
 * Fetches all required data for a sequence and builds the prompt
 */
function fetchPromptDataForSequence(
	sequence: Selectable<EmailSequence>,
	stage?: number,
) {
	return Effect.gen(function* () {
		// Get Instagram account with fresh data check
		const account = yield* db
			.selectFrom("InstagramAccountBase")
			.selectAll()
			.where("id", "=", sequence.instagram_account_id)
			.executeTakeFirstOrThrowE();
		console.log(account);
		// Get recent posts
		const posts = yield* db
			.selectFrom("UniqueInstagramPost")
			.selectAll()
			.where("user_id", "=", account.id)
			.orderBy("taken_at", "desc")
			.limit(20)
			.executeE();

		// Get email if available
		const email = yield* db
			.selectFrom("Email")
			.selectAll()
			.where("instagram_id", "=", account.id)
			.executeTakeFirstE();

		// Determine email type and stage number
		const { emailType, stageNumber } = getEmailTypeFromSequence(sequence);

		// Build OpenAI request payload
		const requestPayload = yield* buildOpenAIRequestPayload(
			account,
			posts,
			emailType,
			email || undefined,
			stage,
		);
		// console.log(requestPayload,"requestPayload for email generation");
		console.log(
			`✓ Prepared prompt data for ${account.username} (${emailType})`,
		);

		return {
			sequence,
			account,
			posts,
			email: email || undefined,
			emailType,
			stageNumber,
			requestPayload,
		};
	});
}

/**
 * Fetches prompt data for multiple sequences, filtering out those with stale data
 */
export function fetchPromptDataForSequences(
	sequences: Selectable<EmailSequence>[],
	stage?: number,
) {
	return Effect.gen(function* () {
		const promptDataList: PromptData[] = [];

		for (const sequence of sequences) {
			const result = yield* fetchPromptDataForSequence(sequence, stage);

			promptDataList.push(result);
		}

		console.log(
			`✓ Prepared prompt data for ${promptDataList.length}/${sequences.length} sequences`,
		);
		return promptDataList;
	});
}

// console.log("Startviral email generation module loaded", startviralFeatures);

// console.log(
// 	"Startviral email generation module benefits:",
// 	startviralBenefits,
// );
// console.log("Startviral email generation module guidelines:", startviralGuidelines);
// console.log("Startviral email generation module examples:", startviralEmailExamples);
// console.log(
// 	await startviralOpenerEmailSystemPromptLanguage("", "German"),
// 	"startviralOpenerEmailSystemPromptLanguage_Prompt",
// );
// console.log(
// 	await startviralTriggerEmailSystemPromptLanguage(
// 		"formattedExamples",
// 		"German",
// 	),
// 	"startviralTriggerEmailSystemPromptLanguage_Prompt",
// );
// const test= await getPromptContentByType("startviralOpenerEmailSystemPromptLanguage_Prompt");

// console.log(test, "startviralOpenerEmailSystemPromptLanguage");
