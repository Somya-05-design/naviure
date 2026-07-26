import { getSettings } from "@/lib/services/content";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/features/about/HeroSection";
import ContactForm from "@/components/features/contact/ContactForm";

export const metadata = {
  title: "Contact",
  description: "Get in touch with NAVIURE for luxury photography services.",
};

export default async function ContactPage() {
  const settings = await getSettings();

  return (
    <>
      <Navbar />
      <main>
        <HeroSection image={settings.heroImage} />
        <ContactForm contact={settings.contact} social={settings.social} />
      </main>
      <Footer footerImage={settings.footerImage} contact={settings.contact} social={settings.social} />
    </>
  );
}
