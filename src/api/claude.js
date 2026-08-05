// Vercel serverless function: POST /api/claude
// Keeps the Anthropic API key on the server — never sent to the browser.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { prompt, maxTokens } = req.body || {};
  if (!prompt) {
    res.status(400).json({ error: "Missing prompt" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server" });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: maxTokens || 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: errText });
      return;
    }

    const data = await response.json();
    const text = (data.content || [])
      .map((b) => b.text || "")
      .join("")
      .trim();

    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: "Claude request failed" });
  }
}
