const ER_URL = "https://open.er-api.com/v6/latest/USD";

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

exports.handler = async function () {
  try {
    const res = await fetch(ER_URL);
    if (!res.ok) throw new Error(`ER-API status ${res.status}`);
    const data = await res.json();
    if (data.result && data.result !== "success") {
      throw new Error(data["error-type"] || data.message || "ER-API error");
    }
    const inr = data.rates && data.rates.INR;
    if (typeof inr !== "number" || inr <= 0) {
      throw new Error("Missing INR rate");
    }
    const usdPerInr = 1 / inr;
    const eurPerInr = data.rates.EUR / inr;
    const gbpPerInr = data.rates.GBP / inr;
    return json(200, {
      ...data,
      source: "ER-API",
      computed: {
        USD: Number(usdPerInr.toFixed(6)),
        EUR: Number(eurPerInr.toFixed(6)),
        GBP: Number(gbpPerInr.toFixed(6)),
      },
    });
  } catch (e) {
    console.error("Currency failed:", e);
    return json(500, { error: "Currency data unavailable" });
  }
};
