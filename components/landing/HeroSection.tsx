"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { DashboardCard, FloatCard } from "@/components/landing/hero";
import { fadeUp, landingStagger, landingStaggerItem } from "@/lib/animations";

interface HeroSectionProps {
  activeOrgCount: number;
}

const HeroSection = ({ activeOrgCount }: HeroSectionProps) => {
  const { isSignedIn } = useAuth();

  // Format org count — show real number or "1.200+" style
  const formattedCount =
    activeOrgCount >= 1000
      ? `${(activeOrgCount / 1000).toFixed(1).replace(".", ",")}k+`
      : `${activeOrgCount}+`;

  return (
    <section
      id="home"
      className="relative min-h-screen flex flex-col items-center justify-center pt-[128px] overflow-hidden bg-white"
    >
      {/* Subtle radial glow behind headline */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(6,148,148,0.07) 0%, transparent 70%)",
        }}
      />

      {/* ── Text content ── */}
      <motion.div
        className="relative z-10 text-center px-6 max-w-4xl mx-auto"
        variants={landingStagger}
        initial="hidden"
        animate="visible"
      >
        {/* Headline — serif italic accent on key word */}
        <motion.h1
          variants={landingStaggerItem}
          className="text-[clamp(38px,6vw,72px)] font-extrabold tracking-[-0.04em] leading-[1.06] text-(--color-text-900) mb-6"
        >
          Ubah Pertanyaan Pelanggan
          <br />
          Jadi{" "}
          <em
            className="not-italic"
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              color: "var(--color-brand)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
            }}
          >
            Jawaban Otomatis
          </em>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          variants={landingStaggerItem}
          className="text-[13px] sm:text-[17px] text-(--color-text-500) 
            max-w-[480px] sm:max-w-[520px] mx-auto leading-relaxed mb-9"
        >
          Upload dokumen bisnis kamu — menu, FAQ, harga.
          <br />
          Kundesk membangun chatbot AI yang menjawab pelanggan kamu 24/7,
          akurat, dan dalam Bahasa Indonesia.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          variants={landingStaggerItem}
          className="flex items-center justify-center gap-3 mb-4 flex-wrap"
        >
          {!isSignedIn && (
            <Link href="/sign-up" className="btn-brand text-[15px] py-3.5 px-8">
              Coba Gratis Sekarang →
            </Link>
          )}

          {isSignedIn && (
            <Link
              href="/dashboard"
              className="btn-brand text-[15px] py-3.5 px-8"
            >
              Buka Dashboard →
            </Link>
          )}

          <Link
            href="#how-it-works"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("how-it-works")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="btn-outline text-[15px] py-3.5 px-8"
          >
            Lihat Demo ▶
          </Link>
        </motion.div>

        {/* Trust micro-copy */}
        <motion.p
          variants={landingStaggerItem}
          className="text-[11px] sm:text-[12.5px] text-(--color-text-400) mb-16"
        >
          ✓ Setup{" "}
          <span className="text-(--color-brand) font-semibold">5 menit</span>
          &nbsp;·&nbsp; ✓ Tidak perlu coding &nbsp;·&nbsp; ✓{" "}
          <span className="text-(--color-brand) font-semibold">
            100 pesan gratis
          </span>{" "}
          tiap bulan
        </motion.p>
      </motion.div>

      {/* ── Hero visual — scenic card with floating stat cards ── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="relative w-full max-w-[900px] mx-auto px-4"
      >
        {/* Scenic gradient background card */}
        <div
          className="relative rounded-t-3xl overflow-hidden"
          style={{ height: "520px" }}
        >
          {/* Hero scenic background */}
          <Image 
            src="/images/bg-hero-market.png"
            alt="Market scenic background"
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />

          {/* ── Dashboard mockup card ── */}
          <DashboardCard />

          {/* ── Floating card: top center — live status ── */}
          <FloatCard
            delay={0}
            className="top-[8%] left-1/2 -translate-x-1/2 px-4 py-2.5 flex items-center gap-2.5 whitespace-nowrap"
          >
            <span className="w-2 h-2 rounded-full bg-(--color-brand) animate-pulse flex-shrink-0" />
            <div>
              <div className="text-[10px] sm:text-[12px] font-bold text-(--color-text-900)">
                Sari Assistant sedang online
              </div>
              <div className="text-[8.5px] sm:text-[1] text-(--color-text-400)">
                142 percakapan hari ini ⚡
              </div>
            </div>
          </FloatCard>

          {/* ── Floating card: left — answered rate ── */}
          <FloatCard
            delay={1}
            className="top-[34%] left-[3%] px-3.5 py-3 flex items-center gap-2.5"
          >
            <div className="w-9 h-9 rounded-xl bg-(--color-brand-light) flex items-center justify-center text-lg flex-shrink-0">
              💬
            </div>
            <div>
              <div className="text-[10px] sm:text-[12px] font-bold text-(--color-text-900)">
                Dijawab otomatis
              </div>
              <div className="text-[8.5px] sm:text-[1] text-(--color-text-400)">
                97.3% akurasi bulan ini
              </div>
            </div>
          </FloatCard>

          {/* ── Floating card: right — active businesses ── */}
          <FloatCard delay={2.5} className="top-[24%] right-[3%] px-3.5 py-3">
            <div className="text-[8.5px] sm:text-[1] text-(--color-text-400) mb-1.5">
              Bisnis yang aktif
            </div>

            {/* Stacked avatars */}
            <div className="flex mb-1.5">
              {[
                { emoji: "🍜", bg: "linear-gradient(135deg,#fbbf24,#f59e0b)" },
                { emoji: "🏥", bg: "linear-gradient(135deg,#60a5fa,#3b82f6)" },
                { emoji: "🏡", bg: "linear-gradient(135deg,#069494,#0891b2)" },
              ].map(({ emoji, bg }, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[13px]"
                  style={{
                    background: bg,
                    marginLeft: i === 0 ? 0 : "-8px",
                  }}
                >
                  {emoji}
                </div>
              ))}
              <div
                className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-(--color-brand) bg-(--color-brand-light)"
                style={{ marginLeft: "-8px" }}
              >
                +
              </div>
            </div>
            <div className="text-[10px] sm:text-[12px] font-bold text-(--color-text-900)">
              {formattedCount} bisnis aktif
            </div>
            <div className="text-[8.5px] sm:text-[1] text-(--color-text-400) mt-0.5">
              Kelola CS mereka pakai Kundesk
            </div>
          </FloatCard>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
