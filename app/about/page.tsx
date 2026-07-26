import { getSettings, getAboutContent } from "@/lib/services/content";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/features/about/HeroSection";
import AboutContent from "@/components/features/about/AboutContent";

export const metadata = {
  title: "About",
  description: "Discover the story behind NAVIURE — luxury photography crafted with cinematic precision.",
};

export default async function AboutPage() {
  const [settings, about] = await Promise.all([getSettings(), getAboutContent()]);

  return (
    <>
      <Navbar />
      <main>
        <HeroSection image={settings.heroImage} />
        <AboutContent content={about} />
      </main>
      <Footer footerImage={settings.footerImage} contact={settings.contact} social={settings.social} />
    </>
  );
}
