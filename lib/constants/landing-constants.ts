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
    desc: "Untuk bisnis yang baru mulai menjajal AI",
    color: "bg-(--color-bg-page)",
    icon: "🌱",
    features: [
      "100 pesan / bulan",
      "3 dokumen upload",
      "1 chatbot",
      "QR Code + link publik",
    ],
    unavailable: [
      "Embed widget",
      "Analytics dashboard",
      "Custom branding",
      "API access",
    ],
  },
  starter: {
    label: "Starter",
    desc: "Untuk bisnis yang sudah aktif melayani pelanggan",
    color: "bg-(--color-brand-light)",
    icon: "⚡",
    features: [
      "1.000 pesan / bulan",
      "20 dokumen upload",
      "1 chatbot",
      "QR Code + link publik",
      "Embed widget",
      "Analytics dasar",
    ],
    unavailable: ["Custom branding", "API access"],
  },
  pro: {
    label: "Pro",
    desc: "Untuk bisnis besar atau agensi yang kelola banyak klien",
    color: "bg-(--color-brand-light)",
    icon: "🚀",
    features: [
      "10.000 pesan / bulan",
      "Dokumen unlimited",
      "3 chatbot",
      "QR Code + link publik",
      "Embed widget",
      "Analytics lengkap",
      "Custom branding",
      "API access",
    ],
    unavailable: [],
  },
};

// ── Features section — dark bg cards ──
export const FEATURES = [
  {
    id: "rag",
    icon: "💬",
    name: "RAG — AI yang Tahu Bisnismu",
    desc: "AI kami hanya menjawab berdasarkan dokumen yang kamu upload. Tidak ada halusinasi, tidak ada jawaban asal — hanya fakta dari bisnismu sendiri.",
    preview: "rag" as const,
  },
  {
    id: "analytics",
    icon: "📊",
    name: "Analytics Real-Time",
    desc: "Lihat apa yang paling sering ditanyakan, jam sibuk, dan topik paling banyak dicari pelanggan kamu — semua dalam satu dashboard.",
    preview: "analytics" as const,
  },
  {
    id: "multitenant",
    icon: "🏢",
    name: "Multi-Tenant & Terisolasi",
    desc: "Setiap bisnis punya workspace tersendiri. Data satu bisnis tidak bisa diakses bisnis lain — dijamin dengan enkripsi dan isolasi penuh.",
    preview: "tenant" as const,
  },
  {
    id: "security",
    icon: "🔒",
    name: "Keamanan Berlapis",
    desc: "Rate limiting, webhook verification, anti prompt-injection, dan AWS S3 presigned URLs — dirancang untuk melindungi data bisnis kamu.",
    preview: "security" as const,
  },
] as const;

// ── How it works steps ──
export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    icon: "📄",
    title: "Upload Dokumen Bisnis",
    desc: "Upload menu, FAQ, daftar harga, atau kebijakan bisnis kamu. PDF, TXT — apapun bisa. AI kami memproses dan mempelajarinya secara otomatis.",
  },
  {
    step: 2,
    icon: "⚙️",
    title: "Konfigurasi Chatbot",
    desc: "Beri nama, pilih bahasa dan nada bicara. Sesuaikan warna dengan brand bisnis kamu. Semuanya bisa diubah kapan saja tanpa coding.",
  },
  {
    step: 3,
    icon: "🚀",
    title: "Bagikan & Aktifkan",
    desc: "Bagikan QR code, tempel di counter atau Instagram bio. Chatbot langsung aktif — menjawab pelanggan 24/7 tanpa kamu harus standby.",
  },
] as const;

// ── Testimonials ──
export const TESTIMONIALS = [
  {
    id: 1,
    quote:
      "Sebelum pakai Kundesk, saya harus balas WhatsApp pelanggan sampai tengah malam. Sekarang chatbot yang kerja, saya tinggal tidur. Omzet naik karena respon lebih cepat dan akurat.",
    name: "Bu Sari Wulandari",
    role: "Pemilik Kedai Bu Sari, Samarinda",
    initials: "BS",
  },
  {
    id: 2,
    quote:
      "Pasien sering nanya jadwal dokter dan harga konsultasi di luar jam kerja. Dengan Kundesk, semua pertanyaan itu terjawab otomatis dari data klinik kami sendiri. Tidak ada jawaban yang salah.",
    name: "dr. Reza Kurniawan",
    role: "Direktur Klinik Sehat Mandiri, Balikpapan",
    initials: "RK",
  },
  {
    id: 3,
    quote:
      "Sebagai developer yang juga pakai Kundesk untuk klien, arsitektur multi-tenantnya sangat solid. Data tiap klien benar-benar terisolasi. Ini yang saya cari sejak lama.",
    name: "Kevin Mahendra",
    role: "Full Stack Developer, Kun Borneo",
    initials: "KM",
  },
] as const;

export interface FaqItems {
  id: number;
  question: string;
  answer: string;
}

// ── FAQ items ──
export const FAQ_ITEMS: FaqItems[] = [
  {
    id: 1,
    question: "Apa itu Kundesk dan bagaimana cara kerjanya?",
    answer:
      "Kundesk adalah platform AI customer service untuk bisnis Indonesia. Kamu upload dokumen bisnis kamu (menu, FAQ, daftar harga), lalu kami membuat chatbot yang menjawab pertanyaan pelanggan berdasarkan dokumen tersebut — bukan dari internet umum. Hasilnya akurat dan relevan untuk bisnismu.",
  },
  {
    id: 2,
    question: "Apakah saya perlu kemampuan coding untuk setup Kundesk?",
    answer:
      "Tidak sama sekali. Upload dokumen, konfigurasi nama chatbot, lalu bagikan QR code atau link ke pelanggan kamu. Selesai dalam 5 menit tanpa menyentuh kode apapun.",
  },
  {
    id: 3,
    question: "Seberapa akurat jawaban chatbot saya?",
    answer:
      "Rata-rata 97.3% pertanyaan terjawab dengan akurat berdasarkan dokumen yang kamu upload. Chatbot hanya menjawab dari sumber yang kamu berikan — jika informasi tidak ada, chatbot akan menyarankan pelanggan untuk menghubungi kamu langsung.",
  },
  {
    id: 4,
    question: "Apakah data bisnis saya aman?",
    answer:
      "Ya, sangat aman. Setiap bisnis memiliki database yang sepenuhnya terisolasi. Dokumen kamu disimpan di AWS S3 dengan enkripsi, dan tidak ada bisnis lain yang bisa mengakses data kamu. Kami menggunakan keamanan berlapis termasuk rate limiting dan webhook verification.",
  },
  {
    id: 5,
    question: "Bisa tidak saya upgrade atau downgrade plan kapan saja?",
    answer:
      "Bisa. Upgrade langsung aktif. Downgrade berlaku di awal periode billing berikutnya. Tidak ada penalti, tidak ada kontrak jangka panjang.",
  },
  {
    id: 6,
    question: "Apakah chatbot bisa berbicara dalam Bahasa Indonesia?",
    answer:
      "Tentu. Kundesk dioptimalkan untuk Bahasa Indonesia termasuk bahasa gaul dan campuran Bahasa-Inggris yang umum digunakan pelanggan Indonesia. Kamu juga bisa pilih mode bilingual (ID + EN) untuk bisnis yang melayani pelanggan asing.",
  },
] as const;

// ── Trust logos — Indonesian business types ──
export const TRUST_LOGOS = [
  { name: "WARUNG MAKAN SARI" },
  { name: "KLINIK SEHAT MANDIRI" },
  { name: "PROPERTI BORNEO" },
  { name: "TOKO BUKU NUSA" },
  { name: "SALON CANTIK" },
  { name: "TOKO ONLINE MAJU" },
  { name: "KEDAI KOPI RASA" },
  { name: "APOTEK SEHAT" },
  { name: "TRAVEL NUSANTARA" },
  { name: "LAUNDRY BERSIH" },
  { name: "BENGKEL JAYA" },
  { name: "BUTIK ELEGAN" },
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
      { label: "Fitur", href: "#features" },
      { label: "Harga", href: "#pricing" },
      { label: "API Docs", href: "#" },
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
