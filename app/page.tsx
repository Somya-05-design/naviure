import { getSettings, getAboutContent } from "@/lib/services/content";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/features/about/HeroSection";
import AboutContent from "@/components/features/about/AboutContent";
import IntroPage from "@/components/features/intro/IntroPage";

export default async function HomePage() {
  const [settings, about] = await Promise.all([getSettings(), getAboutContent()]);

  return (
    <>
      <IntroPage />
      <Navbar />
      <main>
        <HeroSection image={settings.heroImage} />
        <AboutContent content={about} />
      </main>
      <Footer footerImage={settings.footerImage} contact={settings.contact} social={settings.social} />
    </>
  );
}
