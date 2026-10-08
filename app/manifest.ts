import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "На двоих",
    short_name: "На двоих",
    description: "Общие запасы, меню и покупки для двоих",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f7f2",
    theme_color: "#173f35",
    lang: "ru",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
