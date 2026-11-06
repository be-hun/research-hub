import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Source_Serif_4 } from "next/font/google";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import NavProgress from "@/components/NavProgress";
import "./globals.css";

const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "ResearchConnect · Temple research at a glance", template: "%s · ResearchConnect" },
  description: "Explore federally funded research across Temple University, built from public NIH and NSF award records.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-surface px-3 py-2 rounded z-50"
        >
          Skip to content
        </a>
        {/* useSearchParams needs a Suspense boundary so static pages still prerender. */}
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <Header />
        <div id="main" className="flex-grow">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
