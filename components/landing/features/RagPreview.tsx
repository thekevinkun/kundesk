import Image from "next/image";

const RagPreview = () => {
  return (
    <div className="bg-[#1e1e1e] border border-[#333] rounded-xl p-4 mb-6 min-h-[148px]">
      <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#555] mb-3">
        💬 Live Chat Preview
      </div>
      {/* User bubble */}
      <div className="flex justify-end mb-2">
        <div className="bg-(--color-brand) text-white text-[11.5px] px-3 py-2 rounded-xl rounded-br-sm max-w-[80%]">
          Ada menu vegetarian ga?
        </div>
      </div>
      {/* Bot bubble — KUN avatar + reply */}
      <div className="flex justify-start items-end gap-1.5 mb-2">
        <Image
          src="/images/kun_logo.png"
          alt="KUN"
          width={20}
          height={20}
          className="object-contain brightness-[.95]"
        />
        <div className="bg-[#2a2a2a] text-[#ddd] text-[11.5px] px-3 py-2 rounded-xl rounded-bl-sm max-w-[85%]">
          Tentu! Kami punya Nasi Goreng Sayur (Rp 25k), Gado-gado Spesial (Rp
          22k) — bebas seafood ✓
        </div>
      </div>
      {/* Typing indicator — with KUN avatar */}
      <div className="flex items-end gap-1.5">
        <Image
          src="/images/kun_logo.png"
          alt="KUN"
          width={20}
          height={20}
          className="object-contain brightness-[.95]"
        />
        <div className="flex gap-1 px-3 py-2 bg-[#2a2a2a] rounded-xl rounded-bl-sm w-fit">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#666] animate-bounce"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: "1.2s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RagPreview;
