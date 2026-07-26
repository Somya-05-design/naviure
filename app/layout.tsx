import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Great_Vibes } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers/Providers";
import VisitorTracker from "@/components/analytics/VisitorTracker";
import StructuredData from "@/components/seo/StructuredData";
import { getSettings } from "@/lib/services/content";
import { SITE_URL } from "@/lib/constants";
import { getAssetUrl } from "@/lib/assets";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-inter",
  display: "swap",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-script",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const seo = settings.seo;
  const favicon = getAssetUrl("favicon");
  const apple = getAssetUrl("apple-touch-icon");

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: seo.title,
      template: `%s | ${settings.siteName}`,
    },
    description: seo.description,
    keywords: seo.keywords,
    authors: [{ name: settings.siteName }],
    creator: settings.siteName,
    openGraph: {
      type: "website",
      locale: "en_IN",
      url: SITE_URL,
      siteName: settings.siteName,
      title: seo.title,
      description: seo.description,
      images: [{ url: seo.ogImage, width: 1200, height: 630, alt: settings.siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [seo.ogImage],
      creator: seo.twitterHandle,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    alternates: { canonical: seo.canonicalUrl },
    icons: {
      icon: [{ url: favicon }],
      apple: [{ url: apple }],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${inter.variable} ${greatVibes.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-black text-soft-white font-body overflow-x-hidden">
        <StructuredData />
        <VisitorTracker />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
