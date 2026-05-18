import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Tipografia do design Franchise HUB:
//   - Space Grotesk (sans): UI principal — títulos, KPIs, labels
//   - JetBrains Mono: rótulos uppercase e métricas que querem look "tech"
const sans = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Franchise HUB",
  description:
    "Plataforma de gestão de campanhas de anúncios para redes de franquias.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${sans.variable} ${mono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-bg text-text">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
