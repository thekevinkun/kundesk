interface PrivacyHeroProps {
  lastUpdated: string;
}

const PrivacyHero = ({ lastUpdated }: PrivacyHeroProps) => {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg,var(--color-brand) 0%,var(--color-brand-dark) 100%)",
      }}
    >
      <div
        className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-10"
        style={{ background: "white" }}
      />

      <div
        className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full opacity-10"
        style={{ background: "white" }}
      />

      <div className="relative max-w-3xl mx-auto px-6 py-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-white text-sm font-medium mb-6">
          🔒 Privasi & Keamanan Data
        </div>

        <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
          Kebijakan Privasi
        </h1>

        <p className="text-white/80 text-lg max-w-xl">
          Kami berkomitmen untuk melindungi data Anda.
        </p>

        <p className="text-white/60 text-sm mt-6">
          Terakhir diperbarui: {lastUpdated}
        </p>
      </div>
    </div>
  );
};

export default PrivacyHero;
