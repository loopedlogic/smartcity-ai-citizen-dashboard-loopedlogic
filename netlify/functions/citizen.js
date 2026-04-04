const RANDOMUSER_URL = "https://randomuser.me/api/";

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

exports.handler = async function () {
  try {
    let res = await fetch(RANDOMUSER_URL);
    if (!res.ok) throw new Error(`RandomUser status ${res.status}`);
    let data = await res.json();
    if (!data.results || !data.results[0]) {
      res = await fetch(RANDOMUSER_URL);
      if (!res.ok) throw new Error(`RandomUser retry status ${res.status}`);
      data = await res.json();
    }
    if (!data.results || !data.results[0]) {
      throw new Error("Invalid RandomUser payload");
    }
    return json(200, { ...data, source: "RandomUser" });
  } catch (e) {
    console.warn("RandomUser failed, using backup:", e);
    try {
      const resFallback = await fetch(
        "https://jsonplaceholder.typicode.com/users"
      );
      if (!resFallback.ok) throw new Error(`Fallback status ${resFallback.status}`);
      const list = await resFallback.json();
      const user = list[Math.floor(Math.random() * list.length)];
      const nameParts = (user.name || "Guest User").split(" ");
      const first = nameParts[0] || "Guest";
      const last = nameParts.slice(1).join(" ") || "User";
      const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user.name || "Guest"
      )}&background=0D8ABC&color=fff&size=256`;
      const synthetic = {
        results: [
          {
            name: { first, last, title: "Mr" },
            email: user.email || "N/A",
            location: {
              city: (user.address && user.address.city) || "N/A",
              country: "N/A",
            },
            picture: { large: avatar, medium: avatar, thumbnail: avatar },
          },
        ],
        info: { seed: "fallback", results: 1, page: 1, version: "1.0" },
      };
      return json(200, {
        ...synthetic,
        source: "JSONPlaceholder (backup)",
      });
    } catch (err) {
      console.error("Citizen failed:", err);
      return json(500, { error: "Citizen data unavailable" });
    }
  }
};
