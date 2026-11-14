// Static content for the landing page
// All copy in Bahasa Indonesia
// Import into Server Components — no client bundle cost

import type { PlanName } from "@/types/billing";

export interface PlanUIConfig {
  label: string;
  desc: string;
  color: string;
  icon: string;
  features: string[];
  unavailable: string[];
}

// ── Nav links ──
export const NAV_LINKS = [
  { label: "Beranda", href: "#home" },
  { label: "Fitur", href: "#features" },
  { label: "Cara Kerja", href: "#how-it-works" },
  { label: "Harga", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

// ── Pricing plans ──
export const PRICING_PLANS: Record<PlanName, PlanUIConfig> = {
  free: {
    label: "Free",
    desc: "Coba KUN gratis untuk bisnis yang baru mulai",
    color: "bg-(--color-bg-page)",
    icon: "🌱",
    features: [
      "100 pesan / bulan",
      "3 dokumen upload",
      "50 entri Isi Manual",
      "Impor daftar harga dari teks & foto",
      "QR Code + link publik",
    ],
    unavailable: ["Embed widget", "Analytics dashboard"],
  },
  starter: {
    label: "Starter",
    desc: "KUN siap melayani pelanggan bisnis kamu 24/7",
    color: "bg-(--color-brand-light)",
    icon: "⚡",
    features: [
      "1.000 pesan / bulan",
      "20 dokumen upload",
      "300 entri Isi Manual",
      "Impor daftar harga dari teks & foto",
      "QR Code + link publik",
      "Embed widget",
      "Analytics dasar",
    ],
    unavailable: [],
  },
  pro: {
    label: "Pro",
    desc: "KUN untuk bisnis dengan banyak pelanggan dan katalog besar",
    color: "bg-(--color-brand-light)",
    icon: "🚀",
    features: [
      "10.000 pesan / bulan",
      "Dokumen unlimited",
      "1.000 entri Isi Manual",
      "Impor daftar harga dari teks & foto",
      "QR Code + link publik",
      "Embed widget",
      "Analytics lengkap",
    ],
    unavailable: [],
  },
};

// ── Features section — dark bg cards ──
export const FEATURES = [
  {
    id: "rag",
    icon: "💬",
    name: "KUN Tahu Bisnismu",
    desc: "KUN hanya menjawab dari informasi yang kamu berikan — dokumen, foto daftar harga, atau isian manual. Kalau informasinya tidak ada, KUN jujur bilang tidak tahu, bukan menebak.",
    preview: "rag" as const,
    layout: "wide" as const,
    category: "AI dari Data Bisnismu",
  },
  {
    id: "analytics",
    icon: "📊",
    name: "Analytics Real-Time",
    desc: "Lihat apa yang paling sering ditanyakan ke KUN, jam sibuk, dan topik paling banyak dicari pelanggan kamu — semua dalam satu dashboard.",
    preview: "analytics" as const,
    layout: "wide" as const,
    category: "Dashboard Analytics",
  },
  {
    id: "multitenant",
    icon: "🏢",
    name: "Multi-Tenant & Terisolasi",
    desc: "Setiap bisnis punya workspace tersendiri. Data satu bisnis tidak bisa diakses bisnis lain — dijamin dengan enkripsi dan isolasi penuh.",
    preview: "tenant" as const,
    layout: "card" as const,
    category: "Multi-Tenant",
  },
  {
    id: "security",
    icon: "🔒",
    name: "Keamanan Berlapis",
    desc: "Rate limiting, webhook verification, anti prompt-injection, dan AWS S3 presigned URLs — dirancang untuk melindungi data bisnis kamu.",
    preview: "security" as const,
    layout: "card" as const,
    category: "Keamanan",
  },
] as const;

// ── How it works steps ──
export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    icon: "📚",
    title: "Ajari KUN Bisnismu",
    desc: "Upload dokumen (PDF, DOCX, TXT), foto menu atau tempel daftar harga, atau isi lewat formulir. Mulai dari yang kamu punya — kamu cek hasilnya dulu sebelum disimpan.",
  },
  {
    step: 2,
    icon: "⚙️",
    title: "Konfigurasi KUN",
    desc: "Pilih bahasa, tambahkan quick replies, dan sesuaikan warna brand bisnis kamu. Semuanya bisa diubah kapan saja tanpa coding.",
  },
  {
    step: 3,
    icon: "🚀",
    title: "Bagikan & Aktifkan",
    desc: "Bagikan QR code, tempel di counter atau Instagram bio. KUN langsung aktif — menjawab pelanggan 24/7 tanpa kamu harus standby.",
  },
] as const;

// ── Testimonials ──
// Intentionally empty: add only real quotes, with the person's permission
export interface Testimonial {
  id: number;
  quote: string;
  name: string;
  role: string;
  initials: string;
}

export const TESTIMONIALS: Testimonial[] = [];

export interface FaqItems {
  id: number;
  question: string;
  answer: string;
  hasPrivacyLink?: boolean;
}

// ── FAQ items ──
export const FAQ_ITEMS: FaqItems[] = [
  {
    id: 1,
    question: "Apa itu Kundesk dan bagaimana cara kerjanya?",
    answer:
      "Kundesk adalah platform AI customer service untuk bisnis Indonesia. Kamu mengisi informasi bisnis — upload dokumen, foto atau tempel daftar harga, atau isi manual lewat formulir — lalu KUN, asisten AI kami, menjawab pertanyaan pelanggan berdasarkan informasi itu secara otomatis. Hasilnya relevan untuk bisnismu.",
  },
  {
    id: 8,
    question: "Saya tidak punya dokumen, bagaimana?",
    answer:
      "Tidak masalah. Foto menu atau daftar harga kamu, atau tempel daftar harga dari WhatsApp, dan KUN membacanya jadi daftar item. Kamu periksa dan edit dulu sebelum disimpan, karena hasil bacaan tidak selalu sempurna. Kamu juga bisa mengisi langsung lewat formulir Isi Manual: profil bisnis, jam buka, katalog, FAQ, kebijakan, dan promo.",
  },
  {
    id: 2,
    question: "Siapa itu KUN?",
    answer:
      "KUN adalah asisten AI dari Kundesk yang bertugas menjawab pertanyaan pelanggan bisnis kamu 24/7. KUN belajar dari informasi yang kamu berikan — dokumen, daftar harga, atau isian manual — dan hanya menjawab berdasarkan itu. Jika informasinya tidak ada, KUN jujur bilang tidak tahu dan menyarankan pelanggan menghubungi kamu langsung. KUN adalah wajah AI dari bisnis kamu.",
  },
  {
    id: 3,
    question: "Apakah saya perlu kemampuan coding untuk setup Kundesk?",
    answer:
      "Tidak sama sekali. Isi informasi bisnis kamu (upload dokumen, foto daftar harga, atau isi formulir), lalu bagikan QR code atau link ke pelanggan kamu. Setup bisa selesai dalam sekitar 5 menit tanpa menyentuh kode apapun.",
  },
  {
    id: 4,
    question: "Seberapa akurat jawaban KUN?",
    answer:
      "KUN hanya menjawab dari informasi yang kamu berikan, bukan dari pengetahuan umum AI. Jika informasinya tidak ada, KUN menyarankan pelanggan menghubungi kamu langsung. Semakin lengkap dan terbaru informasi bisnismu, semakin akurat jawabannya.",
  },
  {
    id: 5,
    question: "Apakah data bisnis saya aman?",
    answer:
      "Data setiap bisnis dipisahkan dan hanya bisa diakses oleh bisnis itu sendiri. Dokumen disimpan di AWS S3 dan hanya bisa diakses lewat link berumur pendek. Kami memakai keamanan berlapis, termasuk rate limiting dan verifikasi webhook. Agar KUN bisa menjawab, isi informasi bisnis kamu diproses oleh OpenAI. Foto yang kamu impor hanya dibaca lalu dibuang, tidak kami simpan.",
    hasPrivacyLink: true,
  },
  {
    id: 6,
    question: "Bisa tidak saya upgrade atau downgrade plan kapan saja?",
    answer:
      "Bisa. Upgrade langsung aktif. Downgrade berlaku di awal periode billing berikutnya. Tidak ada penalti, tidak ada kontrak jangka panjang.",
  },
  {
    id: 7,
    question: "Apakah KUN bisa berbicara dalam Bahasa Indonesia?",
    answer:
      "Tentu. KUN dioptimalkan untuk Bahasa Indonesia termasuk bahasa gaul dan campuran Bahasa Inggris yang umum digunakan pelanggan Indonesia. Kamu juga bisa pilih mode bilingual (ID + EN) untuk bisnis yang melayani pelanggan asing.",
  },
] as const;

// ── Business types the product is built for (not customers) ──
export const BUSINESS_TYPES = [
  { name: "WARUNG MAKAN" },
  { name: "KLINIK" },
  { name: "PROPERTI" },
  { name: "TOKO BUKU" },
  { name: "SALON" },
  { name: "TOKO ONLINE" },
  { name: "KEDAI KOPI" },
  { name: "APOTEK" },
  { name: "TRAVEL" },
  { name: "LAUNDRY" },
  { name: "BENGKEL" },
  { name: "BUTIK" },
] as const;

// Footer column link type
interface FooterLink {
  label: string;
  href: string;
}

export const FOOTER_COLS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Produk",
    links: [
      { label: "Kenalkan KUN", href: "#home" },
      { label: "Fitur", href: "#features" },
      { label: "Harga", href: "#pricing" },
      { label: "Changelog", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    title: "Perusahaan",
    links: [
      { label: "Tentang Kami", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Karir", href: "#" },
      { label: "Kontak", href: "#" },
      { label: "Kun Borneo", href: "#" },
    ],
  },
  {
    title: "Ikuti Kami",
    links: [
      { label: "LinkedIn", href: "#" },
      { label: "Instagram", href: "#" },
      { label: "Twitter / X", href: "#" },
      { label: "GitHub", href: "#" },
    ],
  },
];
