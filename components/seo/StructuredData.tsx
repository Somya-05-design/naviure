import { getSettings } from "@/lib/services/content";
import { SITE_URL } from "@/lib/constants";

export default async function RootStructuredData() {
  const settings = await getSettings();
  const og = settings.seo.ogImage;
  const image = og.startsWith("http") ? og : `${SITE_URL}${og}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: settings.siteName,
    description: settings.seo.description,
    url: SITE_URL,
    image,
    telephone: settings.contact.phone,
    email: settings.contact.email,
    address: {
      "@type": "PostalAddress",
      addressCountry: "IN",
    },
    sameAs: [settings.social.instagram],
    priceRange: "$$$$",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
