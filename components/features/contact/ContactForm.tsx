"use client";

import { useRef, useState, useActionState } from "react";
import { gsap } from "gsap";
import { useScrollTrigger } from "@/hooks/useAnimations";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";
import MagneticButton from "@/components/ui/MagneticButton";
import { cn } from "@/lib/utils";
import type { ContactSettings, SocialLinks } from "@/types";
import { Camera, Mail, Phone, MessageCircle } from "lucide-react";

interface ContactFormProps {
  contact: ContactSettings;
  social: SocialLinks;
}

const initialState: ContactFormState = { success: false, message: "" };

export default function ContactForm({ contact, social }: ContactFormProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [state, formAction, isPending] = useActionState(submitContactForm, initialState);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useScrollTrigger(() => {
    gsap.from(".contact-reveal", {
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top 70%",
        toggleActions: "play none none reverse",
      },
      y: 60,
      opacity: 0,
      duration: 1,
      stagger: 0.15,
      ease: "power3.out",
    });
  }, []);

  const inputClass = (field: string) =>
    cn(
      "w-full bg-transparent border-b py-4 text-soft-white placeholder:text-soft-white/30",
      "focus:outline-none transition-colors duration-300 text-sm tracking-wide",
      focusedField === field ? "border-emerald" : "border-white/10"
    );

  return (
    <section ref={sectionRef} className="px-4 md:px-8 lg:px-16 py-24 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
        <div>
          <span className="contact-reveal text-xs uppercase tracking-[0.4em] text-emerald mb-4 block">
            Get in Touch
          </span>
          <h2 className="contact-reveal font-display text-4xl md:text-5xl lg:text-6xl text-soft-white font-light leading-tight mb-6">
            Let&apos;s Create<br />Something<br />
            <span className="text-emerald">Extraordinary</span>
          </h2>
          <p className="contact-reveal text-soft-white/50 font-light leading-relaxed mb-12">
            Every great photograph begins with a conversation. Share your vision and let&apos;s craft visual stories that transcend the ordinary.
          </p>

          <div className="contact-reveal space-y-6">
            {[
              { icon: Mail, label: "Email", href: social.email, text: contact.email },
              { icon: Phone, label: "Phone", href: social.phone, text: contact.phone },
              { icon: MessageCircle, label: "WhatsApp", href: social.whatsapp, text: "Message on WhatsApp" },
              { icon: Camera, label: "Instagram", href: social.instagram, text: "@NAVIURE" },
            ].map(({ icon: Icon, label, href, text }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-full glass flex items-center justify-center group-hover:bg-emerald/10 transition-colors">
                  <Icon size={16} className="text-emerald" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-soft-white/40">{label}</p>
                  <p className="text-sm text-soft-white/70 group-hover:text-soft-white transition-colors">{text}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="contact-reveal">
          <form action={formAction} className="glass rounded-sm p-8 md:p-10 space-y-6">
            <div>
              <label htmlFor="name" className="text-[10px] uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className={inputClass("name")}
                onFocus={() => setFocusedField("name")}
                onBlur={() => setFocusedField(null)}
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="text-[10px] uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className={inputClass("email")}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="text-[10px] uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className={inputClass("phone")}
                onFocus={() => setFocusedField("phone")}
                onBlur={() => setFocusedField(null)}
                placeholder="+91"
              />
            </div>

            <div>
              <label htmlFor="message" className="text-[10px] uppercase tracking-[0.2em] text-soft-white/40 mb-2 block">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={4}
                className={cn(inputClass("message"), "resize-none")}
                onFocus={() => setFocusedField("message")}
                onBlur={() => setFocusedField(null)}
                placeholder="Tell us about your project..."
              />
            </div>

            {state.message && (
              <p className={cn("text-sm", state.success ? "text-emerald" : "text-red-400")}>
                {state.message}
              </p>
            )}

            <MagneticButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={isPending}
              className="w-full"
            >
              {isPending ? "Sending..." : "Send Message"}
            </MagneticButton>
          </form>
        </div>
      </div>
    </section>
  );
}
