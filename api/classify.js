const MODEL = "gemini-3.8-flash";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST to classify comments." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is not configured. Add it in Vercel → Project Settings → Environment Variables, then redeploy."
    });
  }

  const comments = Array.isArray(req.body?.comments) ? req.body.comments : [];
  const clean = [...new Set(comments.map(value => String(value ?? "").trim()).filter(Boolean))];
  if (!clean.length) return res.status(400).json({ error: "Provide at least one non-empty comment." });
  if (clean.length > 500) return res.status(400).json({ error: "Please classify 500 or fewer unique comments at a time." });

  try {
    const results = [];
    // Small batches keep each request manageable and allow progress for larger files.
    for (let start = 0; start < clean.length; start += 25) {
      const batch = clean.slice(start, start + 25);
      const prompt = `You are classifying training feedback for an MBA analytics project.
For each input item, classify the comment using only the written text (do not use ratings).
Return ONLY valid JSON with this exact shape:
{"results":[{"id":1,"sentiment":"Positive|Negative|Neutral","theme":"short topic label","summary":"one-sentence neutral summary","action":"short practical follow-up"}]}
Rules:
- Positive means clear praise or satisfaction.
- Negative means dissatisfaction, complaint, problem, or clearly critical feedback.
- Neutral means factual, mixed/unclear, or no clear sentiment.
- Do not assume every suggestion is negative; judge the wording and context.
- Keep theme concise (for example: Content clarity, Training pace, Trainer delivery, Practical examples, Technical issues, Logistics, Engagement, General feedback).
- Keep summary factual; suggested action should be reasonable and not overstate what the comment proves.
- Preserve the order and use each numeric id exactly once.
Comments:
${JSON.stringify(batch.map((comment, index) => ({ id: index + 1, comment })))}`;

      
      let upstream;
      let data = {};
      let lastError = "Gemini is temporarily unavailable.";
      const delays = [1000, 2000, 4000];

      for (let attempt = 0; attempt < delays.length; attempt++) {
        try {
          upstream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
              },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [{ text: prompt }]
                  }
                ],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: "application/json"
                }
              })
            }
          );

          data = await upstream.json().catch(() => ({}));

          if (upstream.ok) break;

          lastError =
            data?.error?.message ||
            `Gemini API returned status ${upstream.status}.`;

          // Retry temporary overload, server, or rate-limit errors.
          if (![429, 500, 502, 503, 504].includes(upstream.status)) {
            return res.status(502).json({ error: lastError });
          }
        } catch (error) {
          upstream = undefined;
          lastError = "Could not connect to Gemini. Please try again.";
        }

        if (attempt < delays.length - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, delays[attempt])
          );
        }
      }

      if (!upstream?.ok) {
        return res.status(502).json({
          error: `Gemini remained unavailable after retries. ${lastError}`
        });
      }

      const responseText =
        data?.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("") || "";

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        return res.status(502).json({ error: "The AI response was not valid JSON. Please try again." });
      }

      const batchResults = Array.isArray(parsed.results) ? parsed.results : [];
      for (const item of batchResults) {
        const index = Number(item.id) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= batch.length) continue;
        const rawSentiment = String(item.sentiment || "").trim().toLowerCase();
        const sentiment = rawSentiment.startsWith("pos") ? "Positive"
          : rawSentiment.startsWith("neg") ? "Negative"
          : rawSentiment.startsWith("neu") ? "Neutral" : "";
        if (!sentiment) continue;
        results.push({
          comment: batch[index],
          sentiment,
          theme: String(item.theme || "General feedback").trim().slice(0, 100),
          summary: String(item.summary || "").trim().slice(0, 400),
          action: String(item.action || "").trim().slice(0, 400)
        });
      }
    }

    if (!results.length) return res.status(502).json({ error: "The AI did not return any valid sentiment labels." });
    return res.status(200).json({ results });
  } catch (error) {
    return res.status(500).json({ error: "AI classification request failed. Please try again." });
  }
}
