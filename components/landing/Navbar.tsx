"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { fadeIn } from "@/lib/animations";
import { NAV_LINKS } from "@/lib/constants/landing-constants";

const Navbar = () => {
  const { isSignedIn } = useAuth();

  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    // Smooth scroll to section
    const id = href.replace("#", "");
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  // Add shadow + border when user scrolls past 20px
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Track active section via IntersectionObserver — highlights correct nav link
  useEffect(() => {
    const sections = document.querySelectorAll("section[id]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      // Trigger when section is 40% visible
      { threshold: 0.4 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <motion.nav
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className={cn(
        "fixed top-0 left-0 right-0 z-50 h-[68px] flex items-center justify-between px-6 lg:px-12 transition-all duration-300",
        "bg-white/90 backdrop-blur-xl",
        scrolled
          ? "border-b border-(--color-border) shadow-[0_1px_20px_rgba(0,0,0,0.06)]"
          : "border-b border-transparent",
      )}
    >
      {/* Logo */}
      <Link href="/" className="flex-shrink-0">
        <Image
          src="/images/logo_kundesk_with_kun.png"
          alt="Kundesk"
          width={132}
          height={48}
          className="w-29 h-12 md:w-33 md:h-12 object-contain"
          priority
        />
      </Link>

      {/* Pill nav — desktop only */}
      <div
        className="hidden lg:flex items-center p-1 gap-0.5 absolute left-1/2 -translate-x-1/2 
        bg-(--color-bg-input) border border-(--color-border) rounded-full"
      >
        {NAV_LINKS.map(({ label, href }) => {
          const sectionId = href.replace("#", "");
          const isActive = activeSection === sectionId;
          return (
            <button
              key={href}
              onClick={() => handleNavClick(href)}
              className={cn(
                "px-4 py-2 rounded-full text-[13.5px] font-medium transition-all duration-200",
                isActive
                  ? "bg-(--color-brand) text-white font-semibold shadow-sm"
                  : "text-(--color-text-500) hover:text-(--color-text-900)",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* CTA — desktop */}
      <div className="hidden lg:flex items-center gap-3">
        {!isSignedIn && (
          <>
            <Link
              href="/sign-in"
              className="text-[13.5px] font-semibold text-(--color-text-700) px-4 py-2 rounded-full border border-transparent hover:border-(--color-border) hover:bg-(--color-bg-input) transition-all"
            >
              Masuk
            </Link>
            <Link
              href="/sign-up"
              className="btn-brand text-[13.5px] py-2.5 px-5"
            >
              Daftar Gratis →
            </Link>
          </>
        )}

        {isSignedIn && (
          <>
            <Link
              href="/dashboard"
              className="btn-brand text-[12.5px] py-2.5 px-5"
            >
              Buka Dashboard →
            </Link>

            <UserButton
              appearance={{
                elements: {
                  avatarBox: "!w-[29px] !h-[29px]",
                },
              }}
            />
          </>
        )}
      </div>

      {/* Hamburger — mobile only */}
      <div className="flex items-center lg:hidden">
        <button
          onClick={() => setMobileOpen((p) => !p)}
          className={`${mobileOpen ? "items-center" : ""} w-9 h-9 flex justify-center 
            rounded-[10px] bg-(--color-bg-input) border 
            border-(--color-border) text-(--color-text-500)`}
          aria-label="Buka menu"
          aria-expanded={mobileOpen}
        >
          <span className={`${mobileOpen ? "!text-lg" : "!text-xl"}`}>{mobileOpen ? "✕" : "☰"}</span>
        </button>

        <UserButton
          appearance={{
            elements: {
              avatarBox: "!w-[29px] !h-[29px] ml-3",
            },
          }}
        />
      </div>

      {/* Mobile menu dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
              duration: 0.2,
              ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            }}
            className="absolute top-[68px] left-0 right-0 bg-white border-b 
              border-(--color-border) shadow-lg p-4 flex flex-col gap-1 lg:hidden"
          >
            {NAV_LINKS.map(({ label, href }) => (
              <button
                key={href}
                onClick={() => handleNavClick(href)}
                className="text-left px-4 py-3 rounded-[10px] text-[14px] font-medium 
                  text-(--color-text-700) hover:bg-(--color-bg-input) transition-all"
              >
                {label}
              </button>
            ))}
            <div className="border-t border-(--color-border) mt-2 pt-3 flex flex-col gap-2">
              {!isSignedIn && (
                <>
                  <Link
                    href="/sign-in"
                    className="px-4 py-3 text-[14px] font-semibold text-(--color-text-700) text-center border border-(--color-border) rounded-full"
                  >
                    Masuk
                  </Link>
                  <Link
                    href="/sign-up"
                    className="btn-brand text-[14px] py-3 text-center justify-center"
                  >
                    Daftar Gratis →
                  </Link>
                </>
              )}

              {isSignedIn && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Link
                    href="/dashboard"
                    className="btn-brand text-[14px] py-3 px-6 text-center justify-center"
                  >
                    Buka Dashboard →
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
