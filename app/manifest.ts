import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Garden",
    short_name: "Garden",
    description: "AI-powered vegetable garden planner",
    start_url: "/today",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#3a7d44",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
