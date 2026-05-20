const SecurityPreview = () => {
  return (
    <div className="bg-[#1e1e1e] border border-[#333] rounded-xl p-4 mb-6 min-h-[148px]">
      <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#555] mb-3">
        🔒 Security Layer
      </div>
      {[
        "Rate limiting per IP & per org",
        "Midtrans webhook signature verified",
        "Prompt injection detection aktif",
        "AWS S3 presigned URLs (5 menit)",
      ].map((item) => (
        <div
          key={item}
          className="flex items-center gap-2 bg-[#242424] rounded-lg px-3 py-2 mb-1.5 last:mb-0"
        >
          <span
            className="text-[14px] flex-shrink-0"
            style={{ color: "#069494" }}
          >
            ✓
          </span>
          <span className="text-[12px] text-[#bbb]">{item}</span>
        </div>
      ))}
    </div>
  );
};

export default SecurityPreview;
