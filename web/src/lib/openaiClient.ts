const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1-mini";

type OpenAIContent = {
  role: "system" | "user";
  content: string;
};

export class OpenAIClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenAIClientError";
    this.status = status;
  }
}

export async function createOpenAIResponse(messages: OpenAIContent[], options: { maxTokens?: number } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OpenAIClientError("OPENAI_API_KEY is not configured.", 500);
  }

  const payload = {
    model: DEFAULT_MODEL,
    input: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    max_output_tokens: options.maxTokens ?? 400,
  };

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      (errorBody as { error?: { message?: string } })?.error?.message ??
      `OpenAI API request failed with status ${response.status}`;
    throw new OpenAIClientError(message, response.status);
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content: Array<{ text?: string }> }>;
  };

  if (typeof data.output_text === "string" && data.output_text.trim().length > 0) {
    return data.output_text.trim();
  }

  const firstText = data.output?.flatMap((entry) => entry.content)?.find((chunk) => typeof chunk.text === "string")?.text;
  if (firstText && firstText.trim().length > 0) {
    return firstText.trim();
  }

  throw new OpenAIClientError("OpenAI API returned no content.", 502);
}
