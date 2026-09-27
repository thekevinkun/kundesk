"use client";

import type { ReactNode } from "react";

interface NumberedSectionProps {
  number?: number;
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}

const NumberedSection = ({
  number,
  icon,
  title,
  description,
  action,
  children,
}: NumberedSectionProps) => (
  <section className="card-base overflow-hidden">
    <div className="px-4 py-4 sm:px-6 border-b border-(--color-border) bg-(--color-bg-page)/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-(--radius-sm) bg-(--color-brand-light) text-(--color-brand-dark) flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="text-[14px] font-bold text-(--color-text-900)">
            {number ? `${number}. ` : ""}
            {title}
          </h2>
          <p className="text-[12px] text-(--color-text-500) mt-0.5">
            {description}
          </p>
        </div>
      </div>
      {action}
    </div>
    <div className="p-4 sm:p-6">{children}</div>
  </section>
);

export default NumberedSection;
