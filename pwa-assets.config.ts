import { defineConfig } from "@vite-pwa/assets-generator/config";

/**
 * The brand source (public/icon.png) is already a full-bleed orange square —
 * the logo sits in its own 20–25% margins.
 *
 * The stock `minimalPreset` pads every generated icon and fills that padding
 * with WHITE (maskable/apple) or transparency (any), so the installed launcher
 * icon showed a white frame around a small orange square, and Android's mask
 * left a white ring behind it. Here the padding is filled with the icon's own
 * orange instead, so every asset is edge-to-edge orange and the logo is only
 * ever as small as the safe zone requires.
 */
const BRAND_ORANGE = "#FCA311";

export default defineConfig({
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[64, "favicon.ico"]],
      // No padding: the source already carries its own orange margins.
      padding: 0,
      resizeOptions: { fit: "contain", background: BRAND_ORANGE },
    },
    maskable: {
      sizes: [512],
      // 5% keeps the logo's corners inside Android's 80%-diameter safe circle
      // (at zero padding they reach 39.1% of the icon radius, i.e. right up to
      // the 40% limit), while the padding itself stays orange, not white.
      padding: 0.05,
      resizeOptions: { fit: "contain", background: BRAND_ORANGE },
    },
    apple: {
      sizes: [180],
      padding: 0.05,
      resizeOptions: { fit: "contain", background: BRAND_ORANGE },
    },
  },
  images: ["public/icon.png"],
});
