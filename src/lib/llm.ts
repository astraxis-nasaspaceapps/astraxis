import "server-only";

/**
 * Minimal provider-agnostic LLM call. Uses whichever key is configured (Anthropic first).
 * Keys live in .env.local and never reach the browser.
 *
 *   ANTHROPIC_API_KEY=...   ANTHROPIC_MODEL=claude-sonnet-5-5 (default)
 *   OPENAI_API_KEY=...      OPENAI_MODEL=<a current chat model>  (set this explicitly)
 *   AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com/
 *   AZURE_OPENAI_API_KEY=...  AZURE_OPENAI_DEPLOYMENT=<deployment name>
 *   AZURE_OPENAI_API_VERSION=2024-10-21 (default)
 */
export type Provider = "azure" | "anthropic" | "openai" | null;

export function activeProvider(): Provider {
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT) return "azure";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export async function complete(system: string, user: string): Promise<{ text: string; provider: Provider; model: string }> {
  const provider = activeProvider();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    if (provider === "azure") {
      const model = process.env.AZURE_OPENAI_DEPLOYMENT as string;
      const base = (process.env.AZURE_OPENAI_ENDPOINT as string).replace(/\/+$/, "");
      const version = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";
      const res = await fetch(`${base}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${version}`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", "api-key": process.env.AZURE_OPENAI_API_KEY as string },
        body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (!res.ok) throw new Error(`Azure OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      return { text: j.choices?.[0]?.message?.content ?? "", provider, model };
    }
    if (provider === "anthropic") {
      const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
      const res = await fetch(`${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY as string,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model, max_tokens: 1000, system, messages: [{ role: "user", content: user }] }),
      });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      const text = (j.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
      return { text, provider, model };
    }
    if (provider === "openai") {
      const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
      const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com"}/v1/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      return { text: j.choices?.[0]?.message?.content ?? "", provider, model };
    }
    throw new Error("No AI provider configured");
  } finally {
    clearTimeout(timer);
  }
}
