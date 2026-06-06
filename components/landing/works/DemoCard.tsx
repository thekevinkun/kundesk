"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { scrollReveal } from "@/lib/animations";

const DemoCard = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPreview, setIsPreview] = useState(true);

  const handlePlay = async () => {
    if (!videoRef.current) return;

    try {
      videoRef.current.currentTime = 0; // restart from beginning
      videoRef.current.loop = false;

      await videoRef.current.play();

      setIsPreview(false);
      setHasStarted(true);
    } catch {
      // Keep empty
    }
  };

  return (
    <motion.div
      variants={scrollReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="mt-20 mx-auto max-w-5xl"
    >
      <div className="mb-6 text-center">
        <span className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.08em] uppercase text-(--color-brand)">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-(--color-brand)" />
          Demo Langsung
        </span>

        <p className="mx-auto mt-1.5 max-w-sm text-[12px] text-(--color-text-400) sm:max-w-full sm:text-[14px]">
          Lihat bagaimana cara agar KUN bekerja secara optimal untuk bisnis
          kamu.
        </p>
      </div>

      <div
        className="
          relative
          overflow-hidden
          rounded-2xl
          border border-(--color-border)
          bg-black
          shadow-[0_32px_80px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.06)]
        "
      >
        <video
          ref={videoRef}
          src="/videos/kundesk_how_to_use.mp4"
          className="block w-full"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          controls={!isPreview}
        />

        {!hasStarted && (
          <button
            type="button"
            onClick={handlePlay}
            aria-label="Putar demo video"
            className="absolute inset-0 flex items-center justify-center bg-black/20"
          >
            <div
              className="
                flex h-20 w-20 items-center justify-center
                rounded-full
                border border-(--color-brand)/20
                bg-(--color-brand)/10
                backdrop-blur
                transition-transform
                hover:scale-105
                cursor-pointer
              "
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default DemoCard;
