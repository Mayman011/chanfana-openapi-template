import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { tasksRouter } from "./endpoints/tasks/router";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { DummyEndpoint } from "./endpoints/dummyEndpoint";

const app = new Hono<{ Bindings: Env }>();

// CORS
app.options("/api/athena", (c) => {
	return c.body(null, 204, {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
	});
});

// ATHENA AI
app.post("/api/athena", async (c) => {
	try {
		const body = await c.req.json<{
			message: string;
			plannerContext?: {
				tasks?: unknown[];
				sessions?: unknown[];
				topics?: unknown[];
			};
		}>();

		if (!body.message) {
			return c.json(
				{ error: "Message is required." },
				400,
				{ "Access-Control-Allow-Origin": "*" }
			);
		}

		const plannerContext = body.plannerContext || {};

		const systemPrompt = `
You are Athena, a friendly AI study assistant.

Your job is to help a student:
- understand school topics
- break assignments into manageable steps
- create study plans
- explain difficult concepts
- create quizzes
- organize their study tasks
- analyze their study progress

Give clear, age-appropriate explanations.
When helping with assignments, guide the student through the work rather than simply doing everything for them.

Here is the student's current planner information:

Tasks:
${JSON.stringify(plannerContext.tasks || [])}

Study sessions:
${JSON.stringify(plannerContext.sessions || [])}

Topics:
${JSON.stringify(plannerContext.topics || [])}
`;

		const openaiResponse = await fetch(
			"https://api.openai.com/v1/responses",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${c.env.OPENAI_API_KEY}`,
				},
				body: JSON.stringify({
					model: "gpt-4o-mini",
					instructions: systemPrompt,
					input: body.message,
				}),
			}
		);

		const data = await openaiResponse.json<any>();

		if (!openaiResponse.ok) {
			console.error("OpenAI error:", data);

			return c.json(
				{
					error: "The AI service returned an error.",
					details: data?.error?.message || "Unknown error",
				},
				500,
				{ "Access-Control-Allow-Origin": "*" }
			);
		}

		const reply =
			data.output_text ||
			"Sorry, Athena couldn't generate a response.";

		return c.json(
			{ reply },
			200,
			{ "Access-Control-Allow-Origin": "*" }
		);

	} catch (error) {
		console.error("Athena error:", error);

		return c.json(
			{ error: "Athena encountered an error." },
			500,
			{ "Access-Control-Allow-Origin": "*" }
		);
	}
});


// Existing error handler
app.onError((err, c) => {
	if (err instanceof ApiException) {
		return c.json(
			{ success: false, errors: err.buildResponse() },
			err.status as ContentfulStatusCode,
		);
	}

	console.error("Global error handler caught:", err);

	return c.json(
		{
			success: false,
			errors: [{ code: 7000, message: "Internal Server Error" }],
		},
		500,
	);
});


// Existing OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
	schema: {
		info: {
			title: "My Awesome API",
			version: "2.0.0",
			description: "This is the documentation for my awesome API.",
		},
	},
});


// Existing endpoints
openapi.route("/tasks", tasksRouter);
openapi.post("/dummy/:slug", DummyEndpoint);

export default app;
