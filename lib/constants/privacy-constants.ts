export const PRIVACY_LAST_UPDATED = "Mei 2026";

export const DATA_COLLECTION_SECTIONS = [
  {
    title: "Data Pemilik Bisnis",
    description:
      "Dikumpulkan saat Anda mendaftar melalui Clerk (penyedia autentikasi kami):",
    items: [
      "Nama",
      "Alamat email",
      "Nama organisasi",
      "Foto profil (opsional)",
    ],
  },
  {
    title: "Data Percakapan Pelanggan",
    description: "Pesan yang dikirim pelanggan ke KUN di bisnis Anda:",
    items: [
      "Isi pesan (teks)",
      "Session ID anonim",
      "Waktu percakapan",
      "Status percakapan",
    ],
    note: "⚠️ Pelanggan tidak memiliki akun di Kundesk. Jika pelanggan mengetikkan informasi pribadi, informasi tersebut tersimpan sebagai bagian dari isi pesan.",
  },
  {
    title: "Data Dokumen",
    description: "Dokumen yang Anda upload sebagai basis pengetahuan KUN:",
    items: ["Isi dokumen (PDF, TXT, DOCX)", "Nama file", "Ukuran file"],
  },
  {
    title: "Data Pembayaran",
    description:
      "Diproses melalui Midtrans — kami tidak menyimpan data kartu kredit:",
    items: ["Riwayat transaksi", "Metode pembayaran", "Status langganan"],
  },
];

export const DATA_USAGE_ITEMS = [
  "Menjalankan layanan KUN AI berdasarkan dokumen bisnis Anda",
  "Memproses pembayaran langganan melalui Midtrans",
  "Mengirimkan email transaksional (tagihan, peringatan penggunaan, notifikasi)",
  "Menampilkan analitik penggunaan di dashboard Anda",
  "Mendeteksi dan mencegah penyalahgunaan layanan",
  "Meningkatkan kualitas layanan secara keseluruhan",
];

export const RETENTION_ITEMS = [
  {
    label: "Pesan percakapan",
    retention: "90 hari",
    note: "Dihapus otomatis setiap hari oleh sistem kami",
    highlight: true,
  },
  {
    label: "Data akun pemilik bisnis",
    retention: "Selama akun aktif",
    note: "Dihapus saat akun dihapus permanen",
  },
  {
    label: "Dokumen yang diupload",
    retention: "Sampai Anda hapus",
    note: "Anda memiliki kontrol penuh",
  },
  {
    label: "Riwayat pembayaran",
    retention: "7 tahun",
    note: "Diperlukan untuk kepatuhan akuntansi",
  },
];

export const THIRD_PARTY_SERVICES = [
  {
    name: "Clerk",
    role: "Autentikasi & manajemen akun",
    country: "🇺🇸 Amerika Serikat",
  },
  {
    name: "Neon",
    role: "Database (PostgreSQL)",
    country: "🇺🇸 Amerika Serikat",
  },
  {
    name: "OpenAI",
    role: "Model AI & embedding teks",
    country: "🇺🇸 Amerika Serikat",
  },
  {
    name: "Midtrans",
    role: "Pemrosesan pembayaran",
    country: "🇮🇩 Indonesia",
  },
  {
    name: "AWS S3",
    role: "Penyimpanan dokumen",
    country: "🇸🇬 Singapura (ap-southeast-1)",
  },
  {
    name: "Pusher",
    role: "Notifikasi real-time",
    country: "🇺🇸 Amerika Serikat",
  },
  {
    name: "Resend",
    role: "Pengiriman email transaksional",
    country: "🇺🇸 Amerika Serikat",
  },
  {
    name: "PostHog",
    role: "Analitik produk (server-side only)",
    country: "🇺🇸 Amerika Serikat",
  },
  {
    name: "Sentry",
    role: "Pemantauan error (PII dihapus sebelum dikirim)",
    country: "🇺🇸 Amerika Serikat",
  },
];

export const SECURITY_ITEMS = [
  "Enkripsi data saat transit (HTTPS/TLS) dan saat istirahat (disk encryption oleh Neon)",
  "Isolasi data antar tenant — setiap bisnis hanya bisa mengakses datanya sendiri",
  "Rate limiting untuk mencegah penyalahgunaan",
  "PII dihapus dari log error sebelum dikirim ke sistem monitoring",
  "Autentikasi dua faktor tersedia melalui Clerk",
];

export const USER_RIGHTS = [
  "Mengakses data pribadi yang kami simpan tentang Anda",
  "Meminta koreksi data yang tidak akurat",
  "Meminta penghapusan akun dan semua data terkait",
  "Mengekspor riwayat percakapan bisnis Anda",
  "Menolak pemrosesan data untuk tujuan tertentu",
];

export const COOKIE_ITEMS = [
  {
    name: "Session cookie",
    purpose: "Menjaga status login Anda (dikelola oleh Clerk)",
  },
  {
    name: "Timezone cookie",
    purpose: "Menampilkan waktu percakapan sesuai zona waktu perangkat Anda",
  },
  {
    name: "Theme preference",
    purpose: "Mengingat preferensi mode terang/gelap",
  },
];

export const POLICY_CHANGE_ITEMS = [
  "Email ke alamat yang terdaftar di akun Anda",
  "Notifikasi di dashboard Kundesk",
  "Pembaruan tanggal 'Terakhir diperbarui' di halaman ini",
];
