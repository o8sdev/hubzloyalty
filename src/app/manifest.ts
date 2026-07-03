import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LoyaltyCRM",
    short_name: "LoyaltyCRM",
    description:
      "The guest book for cafés & restaurants — reviews, check-ins, loyalty.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f6f0e4",
    theme_color: "#d4551e",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Counter — confirm codes",
        url: "/counter",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
