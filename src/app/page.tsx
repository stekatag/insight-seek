import { Navbar } from "@/components/landing/navbar";
import { BenefitsSection } from "@/components/landing/sections/benefits";
import { ContactSection } from "@/components/landing/sections/contact";
import { CTASection } from "@/components/landing/sections/cta";
import { FAQSection } from "@/components/landing/sections/faq";
import { FeaturesSection } from "@/components/landing/sections/features";
import { FooterSection } from "@/components/landing/sections/footer";
import { HeroSection } from "@/components/landing/sections/hero";
import { PricingSection } from "@/components/landing/sections/pricing";
import { TestimonialSection } from "@/components/landing/sections/testimonial";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <BenefitsSection />
      <FeaturesSection />
      <TestimonialSection />
      <CTASection />
      <PricingSection />
      <ContactSection />
      <FAQSection />
      <FooterSection />
    </div>
  );
}
