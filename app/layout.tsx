import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Web Contracts",
  description: "Websites change. Your API shouldn't.",
};

/**
 * Root layout. Intentionally minimal — the dashboard and contract detail
 * pages own their own visual structure. This exists so the App Router has
 * a single root for `html`/`body` and a single import of globals.css.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.variable}>{children}</body>
    </html>
  );
}
