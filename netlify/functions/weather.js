const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=18.52&longitude=73.86&current_weather=true";

const WTTR_URL = "https://wttr.in/18.52,73.86?format=j1";

const weatherCodeMap = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

const fetchInit = {
  headers: { "User-Agent": "SmartCityDashboard/1.0 (Netlify; educational)" },
};

async function fetchFromWttr() {
  const res = await fetch(WTTR_URL, fetchInit);
  if (!res.ok) throw new Error(`wttr.in status ${res.status}`);
  const wttr = await res.json();
  const cc = wttr.current_condition && wttr.current_condition[0];
  if (!cc) throw new Error("wttr.in missing current_condition");
  const temp = parseFloat(cc.temp_C, 10);
  const wind = parseFloat(cc.windspeedKmph, 10);
  if (Number.isNaN(temp) || Number.isNaN(wind)) {
    throw new Error("wttr.in invalid temperature or wind");
  }
  const desc =
    (cc.weatherDesc && cc.weatherDesc[0] && cc.weatherDesc[0].value) || "Unknown";
  const code = Number.parseInt(String(cc.weatherCode), 10);
  return {
    source: "wttr.in (backup — Open-Meteo unavailable)",
    weatherDescription: desc,
    current_weather: {
      temperature: temp,
      windspeed: wind,
      weathercode: Number.isNaN(code) ? 0 : code,
    },
    wttrArea: wttr.nearest_area,
  };
}

exports.handler = async function () {
  try {
    const res = await fetch(WEATHER_URL, fetchInit);
    if (!res.ok) throw new Error(`Open-Meteo status ${res.status}`);
    const data = await res.json();
    if (data.error) {
      throw new Error(data.reason || "Open-Meteo error response");
    }
    const cw = data.current_weather;
    if (!cw || typeof cw.temperature !== "number") {
      throw new Error("Missing current_weather in Open-Meteo response");
    }
    const weatherDescription =
      weatherCodeMap[cw.weathercode] || "Unknown";
    return json(200, {
      ...data,
      source: "Open-Meteo",
      weatherDescription,
    });
  } catch (e) {
    console.warn("Weather primary failed:", e);
    try {
      const fallbackUrl =
        "https://api.open-meteo.com/v1/forecast?latitude=18.52&longitude=73.86&current=temperature_2m,wind_speed_10m,weather_code";
      const resFallback = await fetch(fallbackUrl, fetchInit);
      if (!resFallback.ok) throw new Error(`Fallback status ${resFallback.status}`);
      const fallbackData = await resFallback.json();
      if (fallbackData.error) {
        throw new Error(fallbackData.reason || "Open-Meteo fallback error");
      }
      const cur = fallbackData.current;
      if (!cur) throw new Error("Missing current in fallback");
      const code = cur.weather_code;
      const weatherDescription = weatherCodeMap[code] || "Unknown";
      return json(200, {
        ...fallbackData,
        source: "Open-Meteo (fallback current)",
        current_weather: {
          temperature: cur.temperature_2m,
          windspeed: cur.wind_speed_10m,
          weathercode: code,
        },
        weatherDescription,
      });
    } catch (err) {
      console.warn("Open-Meteo fallbacks failed, trying wttr.in:", err);
      try {
        const body = await fetchFromWttr();
        return json(200, body);
      } catch (wttrErr) {
        console.error("All weather sources failed:", wttrErr);
        return json(500, { error: "Weather data unavailable" });
      }
    }
  }
};
