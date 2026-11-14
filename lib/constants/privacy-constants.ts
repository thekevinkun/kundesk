export const PRIVACY_LAST_UPDATED = "November 2026";

export const DATA_COLLECTION_SECTIONS = [
  {
    title: "Data Pemilik Bisnis",
    description:
      "Dikumpulkan saat Anda mendaftar melalui Clerk (penyedia autentikasi kami):",
    items: [
      "Nama",
      "Alamat email",
      "Nama organisasi",
      "Zona waktu bisnis",
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
      "Alamat IP (sementara, untuk pembatasan laju permintaan)",
    ],
    note: "⚠️ Pelanggan tidak memiliki akun di Kundesk. Jika pelanggan mengetikkan informasi pribadi, informasi tersebut tersimpan sebagai bagian dari isi pesan.",
  },
  {
    title: "Data Dokumen",
    description: "Dokumen yang Anda upload sebagai basis pengetahuan KUN:",
    items: ["Isi dokumen (PDF, DOCX, TXT, MD)", "Nama file", "Ukuran file"],
  },
  {
    title: "Data Isi Manual",
    description:
      "Informasi bisnis yang Anda ketik atau simpan sendiri di halaman Info Bisnis:",
    items: [
      "Profil bisnis (tentang, alamat, kontak, jam operasional, metode pembayaran)",
      "Katalog, FAQ, kebijakan, promo, dan catatan",
    ],
  },
  {
    title: "Data Impor Teks & Foto",
    description:
      "Teks atau foto daftar harga yang Anda gunakan di fitur impor:",
    items: ["Teks yang Anda tempel", "Foto yang Anda pilih"],
    note: "Teks dan foto dikirim ke OpenAI hanya untuk dibaca menjadi daftar item. Kundesk tidak menyimpan teks maupun foto tersebut; yang tersimpan hanya item yang Anda setujui setelah meninjau hasilnya.",
  },
  {
    title: "Data Pembayaran",
    description:
      "Diproses melalui Midtrans — kami tidak menyimpan data kartu kredit:",
    items: ["Riwayat transaksi", "Metode pembayaran", "Status langganan"],
  },
];

export const DATA_USAGE_ITEMS = [
  "Menjalankan layanan KUN AI berdasarkan dokumen dan informasi bisnis Anda",
  "Membaca teks atau foto daftar harga yang Anda impor menjadi daftar item, hanya atas permintaan Anda",
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
    note: "Dihapus permanen 30 hari setelah Anda meminta penghapusan akun",
  },
  {
    label: "Dokumen yang diupload",
    retention: "Sampai Anda hapus",
    note: "Anda memiliki kontrol penuh",
  },
  {
    label: "Informasi Isi Manual (profil, katalog, FAQ)",
    retention: "Sampai Anda hapus",
    note: "Anda dapat mengubah atau menghapusnya kapan saja",
  },
  {
    label: "Teks dan foto impor",
    retention: "Tidak disimpan",
    note: "Hanya dibaca sekali, lalu dibuang",
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
    country: "🇸🇬 Singapura (ap-southeast-1)",
  },
  {
    name: "OpenAI",
    role: "Model AI, embedding teks, dan pembacaan teks/foto daftar harga",
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
    name: "Vercel",
    role: "Hosting aplikasi dan tugas terjadwal harian",
    country: "🇺🇸 Amerika Serikat",
  },
  {
    name: "Upstash",
    role: "Pembatasan laju permintaan dan cache data bisnis (Redis)",
    country: "🇸🇬 Singapura (ap-southeast-1)",
  },
  {
    name: "Pusher",
    role: "Notifikasi real-time",
    country: "🇸🇬 Singapura (ap1)",
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
  "Pemeriksaan ukuran dan isi file yang sebenarnya sebelum dokumen atau foto diproses",
  "PII dihapus dari log error sebelum dikirim ke sistem monitoring",
  "Autentikasi dua faktor tersedia melalui Clerk",
];

export const USER_RIGHTS = [
  "Mengakses data pribadi yang kami simpan tentang Anda",
  "Meminta koreksi data yang tidak akurat",
  "Meminta penghapusan akun dan semua data terkait",
  "Meminta salinan riwayat percakapan bisnis Anda",
  "Menolak pemrosesan data untuk tujuan tertentu",
];

export const COOKIE_ITEMS = [
  {
    name: "Session cookie",
    purpose: "Menjaga status login Anda (dikelola oleh Clerk)",
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
