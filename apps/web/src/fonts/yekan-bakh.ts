import localFont from "next/font/local";

/**
 * Yekan Bakh Fa-En only — never FaNum.
 * DESIGN lists heading-sm at 600; disk has no SemiBold face, so 600 maps to Bold (700 file).
 */
export const yekanBakhFaEn = localFont({
  src: [
    {
      path: "./yekan-bakh/yekan-bakh-fa-en-regular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "./yekan-bakh/yekan-bakh-fa-en-medium.woff",
      weight: "500",
      style: "normal",
    },
    {
      path: "./yekan-bakh/yekan-bakh-fa-en-bold.woff",
      weight: "600",
      style: "normal",
    },
    {
      path: "./yekan-bakh/yekan-bakh-fa-en-bold.woff",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-yekan-bakh",
  display: "swap",
  fallback: ["Tahoma", "Arial", "sans-serif"],
});
