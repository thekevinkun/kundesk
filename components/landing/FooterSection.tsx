import Link from "next/link";
import Image from "next/image";
import { FOOTER_COLS } from "@/lib/constants/landing-constants";

// FooterSection is a Server Component — no interactivity needed
const FooterSection = () => {
  return (
    <footer
      className="border-t px-6 lg:px-16 pt-16 pb-10"
      style={{ background: "#111", borderColor: "#2a2a2a" }}
    >
      {/* Top grid */}
      <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-[1.8fr_1fr_1fr_1fr] gap-12 mb-16">
        {/* Brand column */}
        <div>
          {/* Logo */}
          <div className="mb-4">
            <Image
              src="/images/logo_kundesk_with_kun_white.png"
              alt="Kundesk"
              width={128}
              height={40}
              className="w-29 h-10 sm:w-30 sm:h-12 object-contain"
            />
          </div>
          <p
            className="text-[13.5px] leading-[1.7] max-w-lg md:max-w-[260px]"
            style={{ color: "#666" }}
          >
            Platform AI customer service untuk bisnis Indonesia. Ditenagai KUN —
            asisten AI yang menjawab pelanggan bisnis kamu 24/7, tanpa coding.
          </p>
        </div>

        {/* Link columns */}
        {FOOTER_COLS.map((col) => (
          <div key={col.title}>
            <h4
              className="text-[12px] font-bold tracking-[0.1em] uppercase mb-5"
              style={{ color: "#555" }}
            >
              {col.title}
            </h4>
            <ul className="flex flex-col gap-2.5">
              {col.links.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-[14px] font-bold text-[#888] hover:text-(--color-brand) transition-colors duration-200"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div
        className="max-w-[1100px] mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t"
        style={{ borderColor: "#2a2a2a" }}
      >
        <p className="text-[13px]" style={{ color: "#555" }}>
          © {new Date().getFullYear()} Kundesk · Samarinda, Indonesia
        </p>

        <div className="flex items-center gap-6">
          {[
            { label: "Syarat & Ketentuan", href: "/syarat-ketentuan" },
            { label: "Kebijakan Privasi", href: "/privacy" },
            { label: "Kebijakan Refund", href: "/kebijakan-refund" },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="text-[13px] text-[#555] hover:text-(--color-brand) transition-colors duration-200"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
