import type { Metadata } from "next";
import Link from "next/link";

import {
  PrivacyHero,
  PrivacySection,
  Checklist,
} from "@/components/landing/security";
import { RefundStatusCard, RefundMethodCard } from "@/components/landing/legal";

import {
  REFUND_LAST_UPDATED,
  REFUND_ELIGIBLE_ITEMS,
  REFUND_INELIGIBLE_ITEMS,
  REFUND_PROCESS_STEPS,
  REFUND_METHODS,
  CANCELLATION_RULES,
} from "@/lib/constants/refund-constants";

export const metadata: Metadata = {
  title: "Kebijakan Refund",
  description:
    "Kebijakan pengembalian dana Kundesk — kondisi, proses, dan waktu refund.",
};

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-(--color-bg-page)">
      <PrivacyHero
        lastUpdated={REFUND_LAST_UPDATED}
        badge="💳 Pembayaran & Refund"
        title="Kebijakan Refund"
        subtitle="Kami ingin Anda puas. Berikut kondisi pengembalian dana yang berlaku."
      />

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Intro */}
        <div className="card-base p-8 mb-12 border-l-4 border-(--color-brand)">
          <p className="text-(--color-text-700) leading-relaxed">
            Secara umum, langganan{" "}
            <strong className="text-(--color-text-900)">Kundesk</strong>{" "}
            bersifat non-refundable karena Anda langsung mendapatkan akses penuh
            ke layanan saat pembayaran dikonfirmasi. Namun kami memahami bahwa
            ada situasi tertentu yang memerlukan pengecualian.
          </p>
        </div>

        {/* 01 */}
        <PrivacySection number="01" title="Kondisi Refund">
          <p>Kami memproses refund hanya dalam kondisi berikut:</p>
          <div className="mt-4 space-y-4">
            <RefundStatusCard
              variant="eligible"
              title="Memenuhi Syarat Refund"
              items={REFUND_ELIGIBLE_ITEMS}
            />
            <RefundStatusCard
              variant="ineligible"
              title="Tidak Memenuhi Syarat Refund"
              items={REFUND_INELIGIBLE_ITEMS}
            />
          </div>
        </PrivacySection>

        {/* 02 */}
        <PrivacySection number="02" title="Proses Pengajuan Refund">
          <p>Jika Anda yakin memenuhi syarat refund, ikuti langkah berikut:</p>
          <Checklist items={REFUND_PROCESS_STEPS} />
          <div className="mt-4 card-base p-4 border-l-4 border-amber-400 bg-amber-50/50">
            <p className="text-sm text-(--color-text-700)">
              ⚠️ Pengajuan refund harus dilakukan dalam <strong>14 hari</strong>{" "}
              sejak tanggal transaksi. Pengajuan melewati batas waktu ini tidak
              akan diproses.
            </p>
          </div>
        </PrivacySection>

        {/* 03 */}
        <PrivacySection number="03" title="Metode Pengembalian Dana">
          <p>
            Dana dikembalikan melalui metode pembayaran asal dengan estimasi
            waktu berikut:
          </p>
          <div className="mt-4 space-y-3">
            {REFUND_METHODS.map((item) => (
              <RefundMethodCard key={item.method} {...item} />
            ))}
          </div>
          <p className="mt-4 text-sm">
            Waktu di atas adalah estimasi setelah refund disetujui dan diproses
            dari sisi kami. Waktu aktual bergantung pada Midtrans dan penyedia
            pembayaran masing-masing.
          </p>
        </PrivacySection>

        {/* 04 */}
        <PrivacySection number="04" title="Pembatalan Langganan">
          <p>
            Pembatalan berbeda dari refund. Anda dapat membatalkan langganan
            kapan saja dari halaman Billing di dashboard:
          </p>
          <Checklist items={CANCELLATION_RULES} />
        </PrivacySection>

        {/* 05 */}
        <PrivacySection number="05" title="Hubungi Kami">
          <p>Untuk mengajukan refund atau pertanyaan terkait pembayaran:</p>

          <div className="mt-4 card-base p-6 border-2 border-(--color-brand-mid)">
            <p className="font-bold text-(--color-text-900) mb-1">
              Tim Billing Kundesk
            </p>
            <p className="text-sm text-(--color-text-500) mb-4">
              Respons dalam 3 hari kerja
            </p>
            <a
              href="mailto:refund@kundesk.app"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--color-brand)" }}
            >
              ✉️ refund@kundesk.app
            </a>
          </div>
        </PrivacySection>

        {/* Footer */}
        <div className="pt-8 border-t border-(--color-border) text-center space-y-3">
          <div>
            <Link
              href="/syarat-ketentuan"
              className="text-(--color-brand) font-semibold hover:underline text-sm"
            >
              Baca juga: Syarat & Ketentuan →
            </Link>
          </div>
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-(--color-brand) font-semibold hover:underline"
            >
              ← Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
