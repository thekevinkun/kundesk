import type { Metadata } from "next";
import Link from "next/link";

import {
  PrivacyHero,
  PrivacySection,
  DataPill,
  Checklist,
  RetentionCard,
  ServiceCard,
  CookieCard,
} from "@/components/landing/security";

import {
  PRIVACY_LAST_UPDATED,
  DATA_COLLECTION_SECTIONS,
  DATA_USAGE_ITEMS,
  RETENTION_ITEMS,
  THIRD_PARTY_SERVICES,
  SECURITY_ITEMS,
  USER_RIGHTS,
  COOKIE_ITEMS,
  POLICY_CHANGE_ITEMS,
} from "@/lib/constants/privacy-constants";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — Kundesk",
  description:
    "Kebijakan privasi Kundesk — bagaimana kami mengumpulkan, menggunakan, dan melindungi data Anda.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-(--color-bg-page)">
      <PrivacyHero lastUpdated={PRIVACY_LAST_UPDATED} />

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Intro */}
        <div className="card-base p-8 mb-12 border-l-4 border-(--color-brand)">
          <p className="text-(--color-text-700) leading-relaxed">
            Kebijakan Privasi ini berlaku untuk layanan{" "}
            <strong className="text-(--color-text-900)">Kundesk</strong>{" "}
            yang dioperasikan oleh{" "}
            <strong className="text-(--color-text-900)">Kun Borneo</strong>
            . Dengan menggunakan Kundesk, Anda menyetujui praktik yang
            dijelaskan dalam kebijakan ini. Jika Anda tidak setuju, harap
            hentikan penggunaan layanan kami.
          </p>
        </div>

        {/* 01 */}
        <PrivacySection number="01" title="Data yang Kami Kumpulkan">
          <p>
            Kami mengumpulkan data minimum yang diperlukan untuk menjalankan
            layanan. Berikut kategori data yang kami kumpulkan:
          </p>

          <div className="mt-4 space-y-4">
            {DATA_COLLECTION_SECTIONS.map((section) => (
              <div key={section.title} className="card-base p-5">
                <h3 className="font-semibold text-(--color-text-900) mb-2">
                  {section.title}
                </h3>

                <p className="text-sm mb-3">{section.description}</p>

                <div>
                  {section.items.map((item) => (
                    <DataPill key={item}>{item}</DataPill>
                  ))}
                </div>

                {section.note && (
                  <p className="text-sm mt-3 text-(--color-text-500)">
                    {section.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </PrivacySection>

        {/* 02 */}
        <PrivacySection number="02" title="Bagaimana Kami Menggunakan Data">
          <p>Data yang kami kumpulkan digunakan semata-mata untuk:</p>

          <Checklist items={DATA_USAGE_ITEMS} />

          <p className="mt-4 font-medium text-(--color-text-900)">
            Kami tidak menjual, menyewakan, atau membagikan data Anda kepada
            pihak ketiga untuk tujuan pemasaran.
          </p>
        </PrivacySection>

        {/* 03 */}
        <PrivacySection number="03" title="Retensi Data">
          <p>
            Kami menerapkan kebijakan retensi data yang ketat untuk membatasi
            eksposur data pribadi:
          </p>

          <div className="mt-4 grid gap-4">
            {RETENTION_ITEMS.map((item) => (
              <RetentionCard key={item.label} {...item} />
            ))}
          </div>
        </PrivacySection>

        {/* 04 */}
        <PrivacySection number="04" title="Layanan Pihak Ketiga">
          <p>
            Kundesk menggunakan layanan pihak ketiga terpercaya untuk
            menjalankan infrastrukturnya. Data Anda mungkin diproses oleh:
          </p>

          <div className="mt-4 grid gap-3">
            {THIRD_PARTY_SERVICES.map((service) => (
              <ServiceCard key={service.name} {...service} />
            ))}
          </div>

          <p className="mt-4 text-sm">
            Sebagian besar layanan berlokasi di luar Indonesia. Dengan
            menggunakan Kundesk, Anda menyetujui transfer data lintas batas ini.
          </p>
        </PrivacySection>

        {/* 05 */}
        <PrivacySection number="05" title="Keamanan Data">
          <p>
            Kami menerapkan langkah-langkah keamanan berlapis untuk melindungi
            data Anda:
          </p>

          <Checklist items={SECURITY_ITEMS} />
        </PrivacySection>

        {/* 06 */}
        <PrivacySection number="06" title="Hak-Hak Anda">
          <p>Sebagai pengguna Kundesk, Anda memiliki hak untuk:</p>

          <Checklist items={USER_RIGHTS} />

          <p className="mt-4">
            Untuk menggunakan hak-hak ini, hubungi kami di{" "}
            <a
              href="mailto:privacy@kundesk.app"
              className="font-semibold text-(--color-brand) hover:underline"
            >
              privacy@kundesk.app
            </a>
            . Kami akan merespons dalam 14 hari kerja.
          </p>
        </PrivacySection>

        {/* 07 */}
        <PrivacySection number="07" title="Cookie & Penyimpanan Lokal">
          <p>
            Kundesk menggunakan cookie minimal yang diperlukan untuk menjalankan
            layanan:
          </p>

          <div className="mt-4 space-y-3">
            {COOKIE_ITEMS.map((cookie) => (
              <CookieCard key={cookie.name} {...cookie} />
            ))}
          </div>

          <p className="mt-4 text-sm">
            Kami tidak menggunakan cookie untuk pelacakan iklan atau analitik
            pihak ketiga berbasis browser.
          </p>
        </PrivacySection>

        {/* 08 */}
        <PrivacySection number="08" title="Perubahan Kebijakan">
          <p>
            Kami dapat memperbarui kebijakan ini dari waktu ke waktu. Jika ada
            perubahan material, kami akan memberi tahu Anda melalui:
          </p>

          <Checklist items={POLICY_CHANGE_ITEMS} />

          <p className="mt-4">
            Penggunaan layanan yang berkelanjutan setelah perubahan dianggap
            sebagai penerimaan kebijakan yang diperbarui.
          </p>
        </PrivacySection>

        {/* 09 */}
        <PrivacySection number="09" title="Hubungi Kami">
          <p>
            Untuk pertanyaan, permintaan, atau kekhawatiran terkait privasi:
          </p>

          <div className="mt-4 card-base p-6 border-2 border-(--color-brand-mid)">
            <p className="font-bold text-(--color-text-900) mb-1">
              Kun Borneo
            </p>

            <p className="text-sm text-(--color-text-500) mb-4">
              Samarinda, Kalimantan Timur, Indonesia
            </p>

            <a
              href="mailto:privacy@kundesk.app"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--color-brand)" }}
            >
              ✉️ privacy@kundesk.app
            </a>
          </div>
        </PrivacySection>

        {/* Footer */}
        <div className="pt-8 border-t border-(--color-border) text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-(--color-brand) font-semibold hover:underline"
          >
            ← Kembali ke Beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
