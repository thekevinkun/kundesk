// Shown when orgSlug doesn't exist or KUN is inactive
// Same page for both cases — no enumeration of which case it is
export default function ChatNotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-center px-6">
      <div className="text-4xl mb-4" aria-hidden="true">
        💬
      </div>
      <h1 className="text-gray-800 font-semibold text-lg mb-2">
        KUN tidak aktif
      </h1>
      <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
        Halaman ini tidak tersedia. Pastikan link yang kamu gunakan sudah benar.
      </p>
    </div>
  );
}
