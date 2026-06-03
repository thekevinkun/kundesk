export const REFUND_LAST_UPDATED = "Mei 2026";

export const REFUND_ELIGIBLE_ITEMS = [
  "Anda ditagih ganda untuk periode yang sama karena kesalahan sistem",
  "Pembayaran berhasil diproses tetapi akun tidak terupgrade dalam 24 jam",
  "Layanan mengalami downtime total lebih dari 72 jam berturut-turut dalam satu periode",
];

export const REFUND_INELIGIBLE_ITEMS = [
  "Anda memutuskan tidak ingin menggunakan layanan setelah berlangganan",
  "Anda lupa membatalkan langganan sebelum periode berikutnya",
  "Chatbot tidak memberikan jawaban sesuai harapan (bergantung pada kualitas dokumen Anda)",
  "Anda mengupgrade plan lalu ingin downgrade di tengah periode",
  "Akun dinonaktifkan karena pelanggaran Syarat & Ketentuan",
];

export const REFUND_PROCESS_STEPS = [
  "Kirim email ke refund@kundesk.app dengan subjek: [REFUND] — nama bisnis Anda",
  "Sertakan: alamat email akun, tanggal transaksi, jumlah, dan alasan refund",
  "Tim kami akan merespons dalam 3 hari kerja untuk verifikasi",
  "Jika disetujui, pengembalian dana diproses dalam 7–14 hari kerja",
];

export const REFUND_METHODS = [
  {
    method: "Transfer Bank / Virtual Account",
    timeline: "5–7 hari kerja",
    note: "Dikembalikan ke rekening asal",
  },
  {
    method: "GoPay / OVO / DANA",
    timeline: "1–3 hari kerja",
    note: "Dikembalikan ke dompet digital asal",
  },
  {
    method: "QRIS",
    timeline: "3–5 hari kerja",
    note: "Dikembalikan melalui Midtrans",
  },
  {
    method: "Kartu Kredit",
    timeline: "7–14 hari kerja",
    note: "Bergantung pada kebijakan bank penerbit",
  },
];

export const CANCELLATION_RULES = [
  "Pembatalan berlaku di akhir periode yang sedang berjalan",
  "Anda tetap dapat menggunakan layanan hingga periode berakhir",
  "Tidak ada biaya pembatalan",
  "Data Anda disimpan selama 30 hari setelah pembatalan, lalu dihapus permanen",
];
