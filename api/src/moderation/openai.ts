import { AppFailure, type ThoughtModerator } from "../domain";

const MODERATION_URL = "https://api.openai.com/v1/moderations";
const BLOCKED_CATEGORIES = [
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
] as const;

type OpenAIThoughtModeratorOptions = {
  apiKey: string;
  fetchImpl?: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
  timeoutMs?: number;
};

function containsPersonalInformation(thought: string): boolean {
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(thought)) {
    return true;
  }
  if (/\b(?:https?:\/\/|www\.)\S+/iu.test(thought)) return true;

  const phoneCandidates = thought.match(/\+?\d[\d\s().-]{7,}\d/gu) ?? [];
  return phoneCandidates.some(
    (candidate) => candidate.replace(/\D/gu, "").length >= 9,
  );
}

function thoughtNotAllowed(): AppFailure {
  return new AppFailure(
    "thought_not_allowed",
    "Thought cannot be published",
  );
}

export function createOpenAIThoughtModerator(
  options: OpenAIThoughtModeratorOptions,
): ThoughtModerator {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async assertAllowed(thought) {
      if (containsPersonalInformation(thought)) throw thoughtNotAllowed();

      try {
        const response = await fetchImpl(MODERATION_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "omni-moderation-latest",
            input: thought,
          }),
          signal: AbortSignal.timeout(options.timeoutMs ?? 5_000),
        });
        if (!response.ok) throw new Error("Moderation request failed");

        const body = (await response.json()) as {
          results?: Array<{ categories?: Record<string, unknown> }>;
        };
        const categories = body.results?.[0]?.categories;
        if (!categories) throw new Error("Invalid moderation response");
        for (const category of BLOCKED_CATEGORIES) {
          if (typeof categories[category] !== "boolean") {
            throw new Error("Invalid moderation response");
          }
          if (categories[category]) throw thoughtNotAllowed();
        }
      } catch (error) {
        if (error instanceof AppFailure) throw error;
        throw new AppFailure(
          "moderation_unavailable",
          "Thought moderation is unavailable",
          { cause: error },
        );
      }
    },
  };
}
