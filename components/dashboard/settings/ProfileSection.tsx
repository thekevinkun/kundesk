"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ConfigSection } from "@/components/dashboard/settings";

interface ProfileSectionProps {
  name: string;
  slug: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  handleSlugChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ProfileSection = ({
  name,
  slug,
  setName,
  handleSlugChange,
}: ProfileSectionProps) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <ConfigSection
      title="Profil Bisnis"
      description="Nama dan URL publik KUN kamu."
    >
      <div className="space-y-4">
        <div>
          <Label
            htmlFor="name"
            className="text-[13px] font-semibold text-(--color-text-700) mb-1.5 block"
          >
            Nama Bisnis
          </Label>

          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Kedai Bu Sari"
            maxLength={80}
            className="input-base no-zoom"
            aria-describedby="name-hint"
          />

          <p
            id="name-hint"
            className="text-[11.5px] text-(--color-text-400) mt-1"
          >
            Ditampilkan di dashboard dan disinkronkan ke Clerk.
          </p>
        </div>

        <div>
          <Label
            htmlFor="slug"
            className="text-[13px] font-semibold text-(--color-text-700) mb-1.5 block"
          >
            URL Publik Chat
          </Label>

          <div className="flex items-center gap-0">
            <span className="inline-flex items-center px-3 h-9 rounded-l-[10px] border border-r-0 border-(--color-border) bg-(--color-bg-page) text-[12.5px] text-(--color-text-400) font-mono select-none whitespace-nowrap">
              {appUrl}/chat/
            </span>

            <Input
              id="slug"
              value={slug}
              onChange={handleSlugChange}
              placeholder="nama-bisnis-kamu"
              maxLength={50}
              className="input-base no-zoom rounded-l-none border-l-0 font-mono text-[13px]"
              aria-describedby="slug-hint"
            />
          </div>

          <p
            id="slug-hint"
            className="text-[11.5px] text-(--color-text-400) mt-1"
          >
            Hanya huruf kecil, angka, dan tanda hubung. Mengubah ini akan
            mengubah URL publik KUN kamu.
          </p>
        </div>
      </div>
    </ConfigSection>
  );
};

export default ProfileSection;
