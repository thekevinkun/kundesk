import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { landingStaggerItem } from "@/lib/animations";
import type { FaqItems } from "@/lib/landing-constants";

interface FaqCardItems extends FaqItems {
  isOpen: boolean;
  toggle: () => void;
}

const FaqCard = ({ id, question, answer, isOpen, toggle }: FaqCardItems) => {
  return (
    <motion.div
      id={`${id}`}
      variants={landingStaggerItem}
      className={cn(
        "bg-white rounded-2xl border overflow-hidden transition-colors duration-200",
        isOpen ? "border-(--color-brand-mid)" : "border-(--color-border)",
      )}
    >
      {/* Question row — clickable */}
      <button
        id={`faq-trigger-${id}`}
        onClick={toggle}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={isOpen}
        aria-controls={`faq-panel-${id}`}
      >
        <span
          className={cn(
            "text-[15px] font-semibold transition-colors duration-200",
            isOpen ? "text-(--color-brand)" : "text-(--color-text-900)",
          )}
        >
          {question}
        </span>

        {/* +/× icon circle */}
        <div
          className={cn(
            "w-7 h-7 rounded-full flex justify-center flex-shrink-0 border transition-all duration-300 leading-none select-none",
            isOpen
              ? "bg-(--color-brand-light) border-(--color-brand-mid) text-(--color-brand)"
              : "bg-(--color-bg-input) border-(--color-border) text-(--color-text-500)",
          )}
          style={{
            transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
            transition:
              "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s, border-color 0.2s, color 0.2s",
            fontSize: "18px",
            fontWeight: 300,
          }}
        >
          +
        </div>
      </button>

      {/* Answer — animated height */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`faq-panel-${id}`}
            role="region"
            aria-labelledby={`faq-trigger-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: {
                height: {
                  duration: 0.35,
                  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
                },
                opacity: { duration: 0.25, delay: 0.05 },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: {
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
                },
                opacity: { duration: 0.15 },
              },
            }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 text-[14px] text-(--color-text-500) leading-[1.7]">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FaqCard;
