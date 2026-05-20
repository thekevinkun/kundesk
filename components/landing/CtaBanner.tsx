"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { scrollReveal } from "@/lib/animations";

const CtaBanner = () => {
  return (
    <section className="py-12 px-6 lg:px-16 bg-(--color-bg-input)">
      <motion.div
        variants={scrollReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        className="relative max-w-[1100px] mx-auto bg-white border border-(--color-border) rounded-[28px] px-8 py-20 text-center overflow-hidden shadow-[var(--shadow-sm)]"
      >
        {/* Subtle radial glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, rgba(6,148,148,0.06) 0%, transparent 70%)",
          }}
        />

        {/* Decorative serif watermark — top right */}
        <div
          className="absolute -top-4 right-10 text-[220px] leading-none pointer-events-none select-none opacity-[0.04] text-(--color-brand)"
          style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
        >
          K
        </div>

        {/* Content */}
        <div className="relative z-10">
          <h2 className="text-[clamp(28px,4vw,48px)] font-extrabold tracking-[-0.04em] text-(--color-text-900) leading-[1.1] mb-4">
            Siap Mengotomatiskan
            <br />
            Layanan Pelanggan{" "}
            <em
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                color: "var(--color-brand)",
                fontWeight: 400,
              }}
            >
              Kamu?
            </em>
          </h2>

          <p className="text-[16px] text-(--color-text-500) max-w-[460px] mx-auto leading-relaxed mb-10">
            Gratis untuk memulai. Tidak perlu kartu kredit. Setup selesai dalam
            5 menit.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/sign-up" className="btn-brand text-[15px] py-3.5 px-8">
              Daftar Gratis Sekarang →
            </Link>
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
              Jadwalkan Demo
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default CtaBanner;
