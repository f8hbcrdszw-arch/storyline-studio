import localFont from "next/font/local";

export const sctoGrotesk = localFont({
  src: [
    {
      path: "../../public/fonts/SctoGroteskA-Regular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/SctoGroteskA-RegularItalic.woff",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/SctoGroteskA-Medium.woff",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/SctoGroteskA-MediumItalic.woff",
      weight: "500",
      style: "italic",
    },
  ],
  variable: "--font-scto",
  display: "swap",
});

export const items = localFont({
  src: [
    {
      path: "../../public/fonts/Items-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/Items-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Items-Medium.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-items",
  display: "optional",
});

export const phonicMono = localFont({
  src: [
    {
      path: "../../public/fonts/Phonic-MonospacedRegular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-phonic",
  display: "optional",
});
