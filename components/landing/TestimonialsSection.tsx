"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { scrollReveal, testiSlideVariants } from "@/lib/animations";
import { TESTIMONIALS } from "@/lib/constants/landing-constants";

const TestimonialsSection = () => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const go = useCallback((idx: number, dir: 1 | -1) => {
    setDirection(dir);
    setCurrent(idx);
  }, []);

  const next = useCallback(() => {
    go((current + 1) % TESTIMONIALS.length, 1);
  }, [current, go]);

  const prev = useCallback(() => {
    go((current - 1 + TESTIMONIALS.length) % TESTIMONIALS.length, -1);
  }, [current, go]);

  // Auto-advance every 6 seconds
  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  const testi = TESTIMONIALS[current];

  return (
    <section className="py-24 px-6 lg:px-16 bg-(--color-bg-input) overflow-hidden">
      {/* Section header */}
      <motion.div
        variants={scrollReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        className="text-center mb-14 max-w-2xl mx-auto"
      >
        <div className="text-[12px] font-bold tracking-[0.1em] uppercase text-(--color-brand) mb-4">
          // Kata Mereka
        </div>
        <h2 className="text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.04em] text-(--color-text-900) leading-[1.1] mb-4">
          Dipercaya bisnis di seluruh{" "}
          <em
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              color: "var(--color-brand)",
              fontWeight: 400,
            }}
          >
            Indonesia
          </em>
        </h2>
        <p className="text-[16px] text-(--color-text-500) leading-relaxed">
          Ribuan pemilik bisnis sudah merasakan manfaat Kundesk — dari warung sampai klinik.
        </p>
      </motion.div>

      {/* Carousel */}
      <div className="max-w-[800px] mx-auto">
        <div className="relative overflow-visible">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current}
              custom={direction}
              variants={testiSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="h-[340px] sm:h-[360px] md:h-[340px] bg-white border border-(--color-border)
                rounded-3xl p-8 sm:p-10 md:p-14 shadow-[0_18px_50px_rgba(0,0,0,0.08)]
                ring-1 ring-black/5 flex flex-col overflow-hidden"
            >
              {/* Opening quote mark — serif accent */}
              <div
                className="text-[64px] sm:text-[72px] leading-[0.6] mb-4 sm:mb-6 text-(--color-brand-mid) select-none"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                "
              </div>

              {/* Quote text */}
              {testi?.quote && (
                <p className="text-[16px] sm:text-[17px] text-(--color-text-700) leading-[1.7] sm:leading-[1.75] mb-6 sm:mb-8 font-normal flex-1 overflow-hidden line-clamp-5 sm:line-clamp-6">
                  {testi.quote}
                </p>
              )}

              {/* Author */}
              <div className="mt-auto flex items-center gap-4">
                {testi?.initials && (
                  <div
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white text-[17px] sm:text-[18px] font-extrabold flex-shrink-0 shadow-[0_8px_24px_rgba(6,148,148,0.22)]"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--color-brand), #0891b2)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {testi.initials}
                  </div>
                )}

                <div>
                  {testi?.name && (
                    <div className="text-[15px] font-bold text-(--color-brand) tracking-[-0.01em]">
                      {testi.name}
                    </div>
                  )}

                  {testi?.role && (
                    <div className="text-[13px] text-(--color-text-400) mt-0.5">
                      {testi.role}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 mt-8">
          {/* Prev arrow */}
          <button
            onClick={prev}
            className="w-10 h-10 rounded-full bg-white border border-(--color-border) flex items-center justify-center text-(--color-text-500) hover:border-(--color-brand) hover:text-(--color-brand) transition-all"
            aria-label="Testimonial sebelumnya"
          >
            ←
          </button>

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i, i > current ? 1 : -1)}
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: i === current ? "24px" : "8px",
                  background:
                    i === current
                      ? "var(--color-brand)"
                      : "var(--color-border)",
                }}
                aria-label={`Testimonial ${i + 1}`}
              />
            ))}
          </div>

          {/* Next arrow */}
          <button
            onClick={next}
            className="w-10 h-10 rounded-full bg-white border border-(--color-border) flex items-center justify-center text-(--color-text-500) hover:border-(--color-brand) hover:text-(--color-brand) transition-all"
            aria-label="Testimonial berikutnya"
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
