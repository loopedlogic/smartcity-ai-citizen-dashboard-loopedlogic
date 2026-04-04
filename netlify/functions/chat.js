exports.handler = async function (event) {
  const cors = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

  if (!HF_TOKEN && !OPENROUTER_KEY) {
    return {
      statusCode: 503,
      headers: cors,
      body: JSON.stringify({
        error: "Missing AI key",
        reply:
          "The assistant is not configured. Add HF_TOKEN or OPENROUTER_API_KEY in Netlify environment variables.",
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: cors,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const question = (body.question || "").trim();
  const { weatherData, currencyData, citizenData, factData } =
    body.dashboardData || {};

  if (!question) {
    return {
      statusCode: 400,
      headers: cors,
      body: JSON.stringify({ error: "Empty question" }),
    };
  }

  const context = {
    weatherData,
    currencyData,
    citizenData,
    factData,
  };

  const systemPrompt = `You are a SmartCity dashboard assistant.
You MUST answer ONLY using the JSON object in "dashboardContext" below. Treat it as the only source of truth.
If the user asks for anything not present or inferable from that data (including general knowledge, other cities, or future weather), reply exactly:
"I can only answer based on the live dashboard information currently loaded."
Do not invent numbers, names, emails, or facts. Keep answers short and factual.`;

  const userPayload = `dashboardContext (JSON):\n${JSON.stringify(context, null, 2)}\n\nUser question: ${question}`;

  try {
    let reply;

    if (HF_TOKEN) {
      const prompt = `${systemPrompt}\n\n${userPayload}\n\nAssistant:`;
      const res = await fetch(
        "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 200,
              temperature: 0.2,
              return_full_text: false,
            },
          }),
        }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Hugging Face ${res.status}: ${t.slice(0, 200)}`);
      }
      const hfJson = await res.json();
      if (hfJson && typeof hfJson === "object" && hfJson.error && !Array.isArray(hfJson)) {
        throw new Error(String(hfJson.error));
      }
      reply = extractHfText(hfJson);
    } else if (OPENROUTER_KEY) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://smartcity-dashboard.netlify.app",
          "X-Title": "SmartCity AI Citizen Dashboard",
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 300,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPayload },
          ],
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${t.slice(0, 200)}`);
      }
      const data = await res.json();
      const choice = data.choices && data.choices[0];
      reply = (choice && choice.message && choice.message.content) || "";
      reply = String(reply).trim();
    }

    if (!reply) {
      reply =
        "I can only answer based on the live dashboard information currently loaded.";
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ reply }),
    };
  } catch (error) {
    console.error("Chat backend failure:", error);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({
        error: "Internal server error",
        reply:
          "Sorry, the AI service failed. Check server logs and API keys.",
      }),
    };
  }
};

function extractHfText(data) {
  if (data == null) return "";
  if (typeof data === "string") return data.trim();
  if (Array.isArray(data) && data[0]) {
    if (typeof data[0].generated_text === "string") {
      return data[0].generated_text.trim();
    }
  }
  if (data.generated_text && typeof data.generated_text === "string") {
    return data.generated_text.trim();
  }
  if (data[0] && typeof data[0] === "string") return data[0].trim();
  return "";
}
