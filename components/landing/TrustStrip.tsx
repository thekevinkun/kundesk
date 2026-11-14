"use client";

import { BUSINESS_TYPES } from "@/lib/constants/landing-constants";

// Duplicate array so the marquee loops seamlessly without a visible gap
const MARQUEE_ITEMS = [...BUSINESS_TYPES, ...BUSINESS_TYPES];

const TrustStrip = () => {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "#111" }}
    >
      <div className="relative z-10 pt-18 pb-10">
        {/* Label — says who the product is for, not who uses it */}
        <div className="text-center text-[12px] font-bold tracking-[0.1em] uppercase text-(--color-brand) mb-8">
          // Dibuat untuk bisnis seperti ini
        </div>

        {/* Marquee track */}
        <div className="relative overflow-hidden">
          {/* Left fade */}
          <div
            className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, #111111 0%, transparent 100%)",
            }}
          />
          {/* Right fade */}
          <div
            className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
            style={{
              background:
                "linear-gradient(270deg, #111111 0%, transparent 100%)",
            }}
          />

          {/* Scrolling track — CSS animation, no JS needed */}
          <div className="marquee-track flex gap-0 w-max">
            {MARQUEE_ITEMS.map((item, i) => (
              <div key={i} className="flex items-center flex-shrink-0">
                {/* Business name */}
                <span
                  className="text-lg font-bold tracking-[0.14em] uppercase px-8 
                    whitespace-nowrap transition-colors duration-200 hover:text-brand! cursor-default"
                  style={{
                    color: "#777",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustStrip;
