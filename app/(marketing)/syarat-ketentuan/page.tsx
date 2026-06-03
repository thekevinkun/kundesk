import type { Metadata } from "next";
import Link from "next/link";

import {
  PrivacyHero,
  PrivacySection,
  Checklist,
} from "@/components/landing/security";
import { TermsProhibitedCard } from "@/components/landing/legal";

import {
  TERMS_LAST_UPDATED,
  TERMS_ALLOWED_ITEMS,
  TERMS_PROHIBITED_ITEMS,
  TERMS_ACCOUNT_ITEMS,
  TERMS_CONTENT_ITEMS,
  TERMS_SUBSCRIPTION_ITEMS,
  TERMS_LIMITATION_ITEMS,
  TERMS_TERMINATION_ITEMS,
  TERMS_GOVERNING_ITEMS,
  TERMS_SERVICE_ITEMS,
} from "@/lib/constants/terms-constants";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description:
    "Syarat dan ketentuan penggunaan layanan Kundesk — hak, kewajiban, dan aturan platform.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-(--color-bg-page)">
      <PrivacyHero
        lastUpdated={TERMS_LAST_UPDATED}
        badge="📋 Syarat Penggunaan"
        title="Syarat & Ketentuan"
        subtitle="Harap baca syarat ini sebelum menggunakan layanan Kundesk."
      />

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Intro */}
        <div className="card-base p-8 mb-12 border-l-4 border-(--color-brand)">
          <p className="text-(--color-text-700) leading-relaxed">
            Dengan mendaftar dan menggunakan{" "}
            <strong className="text-(--color-text-900)">Kundesk</strong>, Anda
            menyetujui syarat dan ketentuan yang tercantum di halaman ini.
            Layanan ini dioperasikan oleh{" "}
            <strong className="text-(--color-text-900)">Kun Borneo</strong>.
            Jika Anda tidak menyetujui syarat ini, harap hentikan penggunaan
            layanan.
          </p>
        </div>

        {/* 01 */}
        <PrivacySection number="01" title="Penerimaan Syarat">
          <p>
            Dengan mengakses atau menggunakan Kundesk, Anda menyatakan bahwa
            Anda telah membaca, memahami, dan menyetujui untuk terikat oleh
            syarat dan ketentuan ini beserta{" "}
            <Link
              href="/privacy"
              className="font-semibold text-(--color-brand) hover:underline"
            >
              Kebijakan Privasi
            </Link>{" "}
            kami. Syarat ini berlaku untuk semua pengguna platform, termasuk
            pemilik bisnis dan anggota tim.
          </p>
        </PrivacySection>

        {/* 02 */}
        <PrivacySection number="02" title="Deskripsi Layanan">
          <p>
            Kundesk adalah platform SaaS yang memungkinkan bisnis membuat
            chatbot AI berbasis dokumen untuk melayani pelanggan mereka secara
            otomatis. Layanan mencakup:
          </p>
          <Checklist items={TERMS_SERVICE_ITEMS} />
          <p className="mt-3">
            Kami berhak mengubah, menambah, atau menghapus fitur layanan kapan
            saja dengan pemberitahuan yang wajar.
          </p>
        </PrivacySection>

        {/* 03 */}
        <PrivacySection number="03" title="Akun & Organisasi">
          <p>
            Setiap akun Kundesk mewakili satu organisasi bisnis. Ketentuan akun:
          </p>
          <Checklist items={TERMS_ACCOUNT_ITEMS} />
        </PrivacySection>

        {/* 04 */}
        <PrivacySection
          number="04"
          title="Penggunaan yang Diizinkan & Dilarang"
        >
          <p>Anda diizinkan menggunakan Kundesk untuk:</p>
          <Checklist items={TERMS_ALLOWED_ITEMS} />

          <p className="mt-5 font-medium text-(--color-text-900)">
            Penggunaan berikut ini dilarang keras:
          </p>
          <TermsProhibitedCard items={TERMS_PROHIBITED_ITEMS} />
        </PrivacySection>

        {/* 05 */}
        <PrivacySection number="05" title="Konten & Dokumen Anda">
          <p>
            Anda memiliki kepemilikan penuh atas konten yang Anda upload ke
            Kundesk. Namun perlu dipahami:
          </p>
          <Checklist items={TERMS_CONTENT_ITEMS} />
        </PrivacySection>

        {/* 06 */}
        <PrivacySection number="06" title="Langganan & Pembayaran">
          <p>
            Kundesk menawarkan tiga plan langganan — Free, Starter, dan Pro —
            yang ditagih bulanan melalui Midtrans. Ketentuan pembayaran:
          </p>
          <Checklist items={TERMS_SUBSCRIPTION_ITEMS} />
          <p className="mt-3">
            Untuk detail kebijakan pengembalian dana, lihat{" "}
            <Link
              href="/kebijakan-refund"
              className="font-semibold text-(--color-brand) hover:underline"
            >
              Kebijakan Refund
            </Link>{" "}
            kami.
          </p>
        </PrivacySection>

        {/* 07 */}
        <PrivacySection number="07" title="Batasan Layanan">
          <p>Harap pahami batasan layanan berikut sebelum berlangganan:</p>
          <Checklist items={TERMS_LIMITATION_ITEMS} />
        </PrivacySection>

        {/* 08 */}
        <PrivacySection number="08" title="Penghentian Akun">
          <Checklist items={TERMS_TERMINATION_ITEMS} />
        </PrivacySection>

        {/* 09 */}
        <PrivacySection number="09" title="Perubahan Syarat">
          <p>
            Kami dapat memperbarui syarat ini dari waktu ke waktu. Perubahan
            material akan dikomunikasikan melalui email dan notifikasi dashboard
            minimal 7 hari sebelum berlaku. Penggunaan layanan yang
            berkelanjutan setelah perubahan dianggap sebagai penerimaan syarat
            yang diperbarui.
          </p>
        </PrivacySection>

        {/* 10 */}
        <PrivacySection number="10" title="Hukum yang Berlaku">
          <Checklist items={TERMS_GOVERNING_ITEMS} />
        </PrivacySection>

        {/* 11 */}
        <PrivacySection number="11" title="Hubungi Kami">
          <p>Untuk pertanyaan terkait syarat dan ketentuan ini:</p>

          <div className="mt-4 card-base p-6 border-2 border-(--color-brand-mid)">
            <p className="font-bold text-(--color-text-900) mb-1">Kun Borneo</p>
            <p className="text-sm text-(--color-text-500) mb-4">
              Samarinda, Kalimantan Timur, Indonesia
            </p>
            <a
              href="mailto:legal@kundesk.app"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--color-brand)" }}
            >
              ✉️ legal@kundesk.app
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
