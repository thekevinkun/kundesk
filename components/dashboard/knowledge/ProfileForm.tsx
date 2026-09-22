"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ContactsEditor from "./ContactsEditor";
import PaymentMethodsEditor from "./PaymentMethodsEditor";
import HoursEditor from "./HoursEditor";
import { saveBusinessProfile } from "@/lib/actions/knowledge";
import type {
  CompileProfile,
  ContactItem,
  HoursSchedule,
  PaymentMethod,
} from "@/types/knowledge";

interface ProfileFormProps {
  isAdmin: boolean;
  initialProfile: CompileProfile;
}

// Local section wrapper — same visual language as ChatbotConfigPage's
// ConfigSection, kept separate since that one isn't exported for reuse
const ProfileSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <div className="card-base p-6">
    <div className="mb-4">
      <h2 className="text-[15px] font-bold text-(--color-text-900) mb-1">
        {title}
      </h2>
      <p className="text-[12.5px] text-(--color-text-400)">{description}</p>
    </div>
    <Separator className="mb-4 bg-(--color-border-sm)" />
    {children}
  </div>
);

const ProfileForm = ({ isAdmin, initialProfile }: ProfileFormProps) => {
  const [about, setAbout] = useState(initialProfile.about ?? "");
  const [address, setAddress] = useState(initialProfile.address ?? "");
  const [contacts, setContacts] = useState<ContactItem[]>(
    initialProfile.contacts,
  );
  const [hours, setHours] = useState<HoursSchedule[]>(initialProfile.hours);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    initialProfile.paymentMethods,
  );

  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveBusinessProfile({
        about,
        address,
        contacts,
        hours,
        paymentMethods,
      });

      if (result.success) {
        toast.success("Profil disimpan", {
          description:
            "KUN akan menggunakan info ini untuk menjawab pelanggan.",
        });
      } else {
        toast.error("Gagal menyimpan", { description: result.error });
      }
    });
  };

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <div className="px-4 py-3 rounded-(--radius-sm) bg-(--color-bg-page) border border-(--color-border) text-[12.5px] text-(--color-text-500)">
          Hubungi admin untuk mengubah profil bisnis. Kamu masih bisa melihat
          info di bawah.
        </div>
      )}

      <ProfileSection
        title="Tentang Bisnis"
        description="Deskripsi singkat yang membantu KUN menjawab pertanyaan umum tentang bisnismu."
      >
        <Textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="Contoh: Kedai Bu Sari adalah warung makan rumahan yang buka sejak 2015..."
          maxLength={1000}
          rows={4}
          disabled={!isAdmin}
          className="input-base no-zoom resize-none h-[110px] overflow-y-auto"
          aria-label="Deskripsi bisnis"
        />
      </ProfileSection>

      <ProfileSection
        title="Alamat"
        description="Alamat lengkap — KUN akan menyebutkan ini jika pelanggan bertanya lokasi."
      >
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Contoh: Jl. Merdeka No. 12, Balikpapan"
          maxLength={300}
          disabled={!isAdmin}
          className="input-base"
          aria-label="Alamat bisnis"
        />
      </ProfileSection>

      <ProfileSection
        title="Kontak"
        description="Nomor WhatsApp, telepon, atau kontak lain yang perlu diketahui pelanggan."
      >
        <ContactsEditor
          contacts={contacts}
          onChange={setContacts}
          disabled={!isAdmin}
        />
      </ProfileSection>

      <ProfileSection
        title="Jam Operasional"
        description="Bisa lebih dari satu jadwal — misalnya jadwal klinik dan jadwal darurat yang berbeda."
      >
        <HoursEditor hours={hours} onChange={setHours} disabled={!isAdmin} />
      </ProfileSection>

      <ProfileSection
        title="Metode Pembayaran"
        description="Cara pelanggan bisa membayar — QRIS, transfer bank, tunai, dan sebagainya."
      >
        <PaymentMethodsEditor
          methods={paymentMethods}
          onChange={setPaymentMethods}
          disabled={!isAdmin}
        />
      </ProfileSection>

      {isAdmin && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[12px] text-(--color-text-400)">
            Perubahan berlaku setelah disimpan dan diproses ulang oleh KUN.
          </p>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="btn-brand min-w-[120px]"
            aria-busy={isPending}
          >
            {isPending ? "Menyimpan..." : "Simpan Profil"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProfileForm;
