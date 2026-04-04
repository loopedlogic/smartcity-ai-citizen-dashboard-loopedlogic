const FACT_URL =
  "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en";

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

exports.handler = async function () {
  try {
    const res = await fetch(FACT_URL);
    if (!res.ok) throw new Error(`UselessFacts status ${res.status}`);
    const data = await res.json();
    if (data.text == null || String(data.text).trim() === "") {
      throw new Error("Empty fact text");
    }
    return json(200, {
      ...data,
      providerLabel: "UselessFacts",
      cardTitle: "City Fact of the Day",
    });
  } catch (e) {
    console.warn("UselessFacts failed:", e);
    try {
      const resFallback = await fetch("https://api.adviceslip.com/advice");
      if (!resFallback.ok) throw new Error(`AdviceSlip status ${resFallback.status}`);
      const wrapped = await resFallback.json();
      const advice = wrapped.slip && wrapped.slip.advice;
      if (!advice) throw new Error("No advice in response");
      return json(200, {
        id: wrapped.slip.id,
        text: advice,
        providerLabel: "AdviceSlip (backup)",
        cardTitle: "City Fact of the Day",
      });
    } catch (err) {
      console.error("Fact failed:", err);
      return json(500, { error: "Fact data unavailable" });
    }
  }
};
