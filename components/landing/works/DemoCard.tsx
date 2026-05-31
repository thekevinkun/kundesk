"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { scrollReveal } from "@/lib/animations";

const DemoCard = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      setHasStarted(true);
      void videoRef.current.play();
    }
  };

  return (
    <motion.div
      variants={scrollReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="mt-20 max-w-[900px] mx-auto"
    >
      {/* Label above video */}
      <div className="text-center mb-6">
        <span className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.08em] uppercase text-(--color-brand)">
          <span className="w-1.5 h-1.5 rounded-full bg-(--color-brand) animate-pulse inline-block" />
          Demo Langsung
        </span>
        <p className="max-w-sm sm:max-w-full mx-auto text-[12px] sm:text-[14px] text-(--color-text-400) mt-1.5">
          Lihat bagaimana cara agar KUN bekerja secara optimal untuk bisnis
          kamu.
        </p>
      </div>

      {/* Video container — browser chrome style */}
      <div className="rounded-2xl overflow-hidden border border-(--color-border) shadow-[0_32px_80px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.06)] bg-white">
        {/* Fake browser chrome top bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-(--color-bg-page) border-b border-(--color-border)">
          {/* Traffic light dots */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          {/* Fake URL bar */}
          <div className="flex-1 mx-3">
            <div className="bg-white border border-(--color-border) rounded-md px-3 py-1 text-[11.5px] text-(--color-text-400) font-mono text-center max-w-[320px] mx-auto">
              kundesk.vercel.app/dashboard
            </div>
          </div>
        </div>

        {/* Video */}
        <div className="relative bg-black aspect-video">
          <video
            ref={videoRef}
            src="/videos/kundesk-demo.mp4"
            className="w-full h-full object-cover"
            onPlay={() => {
              setIsPlaying(true);
              setHasStarted(true);
            }}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            controls
            playsInline
            preload="metadata"
          />

          {/* Custom play overlay — shown before first play */}
          {!hasStarted && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center group"
              aria-label="Putar demo video"
            >
              {/* Backdrop blur circle */}
              <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/30 transition-all duration-300 group-hover:scale-110 group-hover:bg-white/25">
                {/* Play triangle */}
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="white"
                  className="ml-1"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default DemoCard;
