import { motion } from "framer-motion";
import { floatVariant } from "@/lib/animations";

const FloatCard = ({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    variants={floatVariant(delay)}
    initial="initial"
    animate="animate"
    className={`absolute bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] 
        border border-white/80 backdrop-blur-sm ${className}`}
  >
    {children}
  </motion.div>
);

export default FloatCard;
