import type { Metadata } from "next";
import { Inter, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/contexts/ToastContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GhostAgent | Turn Instagram DMs into Automated Sales",
  description: "Transform your social direct messages into automated sales, lead generation, and instant booking slots with GhostAgent. Set up in 3 minutes.",
  keywords: ["Instagram automation", "WhatsApp automation", "AI chatbot", "DM automation", "social media sales", "appointment booking", "GhostAgent"],
  metadataBase: new URL("https://getghostagent.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "GhostAgent | Turn Instagram DMs into Automated Sales",
    description: "Transform your social direct messages into automated sales, lead generation, and instant booking slots with GhostAgent. Set up in 3 minutes.",
    url: "https://getghostagent.com",
    siteName: "GhostAgent",
    images: [
      {
        url: "/ghostagent-profile.png",
        width: 800,
        height: 800,
        alt: "GhostAgent — Turn DMs into Automated Revenue",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GhostAgent | Turn Instagram DMs into Automated Sales",
    description: "Transform your social direct messages into automated sales, lead generation, and instant booking slots with GhostAgent. Set up in 3 minutes.",
    images: ["/ghostagent-profile.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "GhostAgent",
              "alternateName": ["Ghost Agent"],
              "url": "https://getghostagent.com"
            })
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} ${plusJakarta.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
