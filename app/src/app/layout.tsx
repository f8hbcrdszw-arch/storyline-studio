import type { Metadata } from "next";
import { sctoGrotesk, items, phonicMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Storyline Studio",
  description: "Web survey platform with video dial testing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sctoGrotesk.variable} ${items.variable} ${phonicMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
