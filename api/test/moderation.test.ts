import { describe, expect, test } from "bun:test";
import { createOpenAIThoughtModerator } from "../src/moderation/openai";

const categoryDefaults = {
  harassment: false,
  "harassment/threatening": false,
  hate: false,
  "hate/threatening": false,
  illicit: false,
  "illicit/violent": false,
  "self-harm": false,
  "self-harm/instructions": false,
  "self-harm/intent": false,
  sexual: false,
  "sexual/minors": false,
  violence: false,
  "violence/graphic": false,
};

function moderationResponse(
  categories: Partial<typeof categoryDefaults> = {},
): Response {
  const completeCategories = { ...categoryDefaults, ...categories };
  return Response.json({
    id: "modr_test",
    model: "omni-moderation-latest",
    results: [
      {
        flagged: Object.values(completeCategories).some(Boolean),
        categories: completeCategories,
        category_scores: Object.fromEntries(
          Object.keys(completeCategories).map((category) => [category, 0]),
        ),
        category_applied_input_types: Object.fromEntries(
          Object.keys(completeCategories).map((category) => [category, ["text"]]),
        ),
      },
    ],
  });
}

describe("OpenAI thought moderation", () => {
  test("sends text to omni moderation and allows a safe thought", async () => {
    let receivedRequest: Request | undefined;
    const moderator = createOpenAIThoughtModerator({
      apiKey: "moderation-secret",
      fetchImpl: async (input, init) => {
        receivedRequest = new Request(input, init);
        return moderationResponse();
      },
    });

    await expect(
      moderator.assertAllowed("the room after everyone leaves"),
    ).resolves.toBeUndefined();
    expect(receivedRequest?.url).toBe("https://api.openai.com/v1/moderations");
    expect(receivedRequest?.headers.get("authorization")).toBe(
      "Bearer moderation-secret",
    );
    expect(await receivedRequest?.json()).toEqual({
      model: "omni-moderation-latest",
      input: "the room after everyone leaves",
    });
  });

  test.each([
    "harassment",
    "harassment/threatening",
    "hate",
    "hate/threatening",
    "illicit/violent",
    "self-harm",
    "self-harm/instructions",
    "self-harm/intent",
    "sexual",
    "sexual/minors",
    "violence/graphic",
  ] as const)("rejects the blocked category %s", async (category) => {
    const moderator = createOpenAIThoughtModerator({
      apiKey: "moderation-secret",
      fetchImpl: async () => moderationResponse({ [category]: true }),
    });

    await expect(moderator.assertAllowed("private thought")).rejects.toMatchObject({
      code: "thought_not_allowed",
    });
  });

  test("allows non-graphic violence instead of blindly trusting flagged", async () => {
    const moderator = createOpenAIThoughtModerator({
      apiKey: "moderation-secret",
      fetchImpl: async () => moderationResponse({ violence: true }),
    });

    await expect(
      moderator.assertAllowed("a memory of a distant battle"),
    ).resolves.toBeUndefined();
  });

  test.each([
    "write me at person@example.com",
    "visit https://example.com/private",
    "call me at +51 987 654 321",
  ])("rejects public personal information locally: %s", async (thought) => {
    let calls = 0;
    const moderator = createOpenAIThoughtModerator({
      apiKey: "moderation-secret",
      fetchImpl: async () => {
        calls += 1;
        return moderationResponse();
      },
    });

    await expect(moderator.assertAllowed(thought)).rejects.toMatchObject({
      code: "thought_not_allowed",
    });
    expect(calls).toBe(0);
  });

  test.each([
    async () => new Response("upstream detail", { status: 500 }),
    async () => Response.json({ results: [] }),
    async () => {
      throw new Error("network detail");
    },
  ])("fails closed without exposing provider details", async (fetchImpl) => {
    const moderator = createOpenAIThoughtModerator({
      apiKey: "moderation-secret",
      fetchImpl,
    });

    await expect(
      moderator.assertAllowed("a harmless thought"),
    ).rejects.toMatchObject({
      code: "moderation_unavailable",
      message: "Thought moderation is unavailable",
    });
  });
});
