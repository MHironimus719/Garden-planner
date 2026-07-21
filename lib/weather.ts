// Server-side weather via Open-Meteo (free, no API key), geocoding the garden's
// zip through zippopotam.us. Shared by the /api/weather route and gardenContext.

// WMO weather interpretation codes → label + icon
const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear", icon: "☀️" },
  1: { label: "Mostly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Freezing fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌦️" },
  56: { label: "Freezing drizzle", icon: "🌧️" },
  57: { label: "Freezing drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌧️" },
  67: { label: "Freezing rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Heavy snow", icon: "🌨️" },
  77: { label: "Snow grains", icon: "🌨️" },
  80: { label: "Light showers", icon: "🌦️" },
  81: { label: "Showers", icon: "🌦️" },
  82: { label: "Heavy showers", icon: "🌧️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Snow showers", icon: "🌨️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm, hail", icon: "⛈️" },
  99: { label: "Thunderstorm, hail", icon: "⛈️" },
};

export type Weather = {
  place: string;
  current: { temp: number; feelsLike: number; humidity: number; wind: number; label: string; icon: string };
  today: { date: string; hi: number; lo: number; precipChance: number; precipSum: number };
  days: { date: string; hi: number; lo: number; precipChance: number; precipSum: number }[];
  frostWarning: { date: string; low: number } | null;
};

// Module-level cache: one zip per garden, 15-minute freshness is plenty.
let cached: { zip: string; ts: number; payload: Weather } | null = null;
const TTL_MS = 15 * 60 * 1000;

export async function getWeather(zip: string): Promise<Weather> {
  if (cached && cached.zip === zip && Date.now() - cached.ts < TTL_MS) return cached.payload;

  const geo = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`).then((r) => {
    if (!r.ok) throw new Error(`zip ${zip} not found`);
    return r.json();
  });
  const place = geo.places?.[0];
  if (!place) throw new Error(`zip ${zip} not found`);

  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "5",
  });
  const wx = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`).then((r) => {
    if (!r.ok) throw new Error("weather service unavailable");
    return r.json();
  });

  const days = (wx.daily.time as string[]).map((date, i) => ({
    date,
    hi: wx.daily.temperature_2m_max[i] as number,
    lo: wx.daily.temperature_2m_min[i] as number,
    precipChance: wx.daily.precipitation_probability_max[i] as number,
    precipSum: wx.daily.precipitation_sum[i] as number,
  }));
  const frost = days.find((d) => d.lo <= 36);

  const payload: Weather = {
    place: place["place name"] as string,
    current: {
      temp: wx.current.temperature_2m as number,
      feelsLike: wx.current.apparent_temperature as number,
      humidity: wx.current.relative_humidity_2m as number,
      wind: wx.current.wind_speed_10m as number,
      ...(WMO[wx.current.weather_code as number] ?? { label: "—", icon: "🌡️" }),
    },
    today: days[0],
    days,
    frostWarning: frost ? { date: frost.date, low: frost.lo } : null,
  };
  cached = { zip, ts: Date.now(), payload };
  return payload;
}
