"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Store, Clock, CreditCard, BookOpen } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ContactsEditor from "./ContactsEditor";
import PaymentMethodsEditor from "./PaymentMethodsEditor";
import HoursEditor from "./HoursEditor";
import NumberedSection from "./NumberedSection";
import { KnowledgeSectionsPanel } from "@/components/dashboard/knowledge/sections";
import { saveBusinessProfile } from "@/lib/actions/knowledge";
import { newEditorId } from "@/helpers/editor-id";
import type {
  EditableContact,
  EditableHoursSchedule,
  EditablePaymentMethod,
} from "@/types/knowledge-editor";
import type {
  CompileProfile,
  ContactItem,
  HoursSchedule,
  KnowledgeSectionRow,
  PaymentMethod,
} from "@/types/knowledge";
import type { PlanName } from "@/types/billing";

interface ProfileFormProps {
  isAdmin: boolean;
  initialProfile: CompileProfile;
  initialSections: KnowledgeSectionRow[];
  plan: PlanName;
}

// Sub-tabs under "Isi Manual" — replaces the old scroll-jump quick-nav.
// Naming kept generic (not "profil") since this now covers more than
// business-profile fields.
type ManualSubTab = "identitas" | "jam" | "pembayaran" | "katalog";

const toEditableContacts = (contacts: ContactItem[]): EditableContact[] =>
  contacts.map((c) => ({ ...c, editorId: newEditorId() }));

const toEditablePaymentMethods = (
  methods: PaymentMethod[],
): EditablePaymentMethod[] =>
  methods.map((m) => ({ ...m, editorId: newEditorId() }));

const toEditableHours = (hours: HoursSchedule[]): EditableHoursSchedule[] =>
  hours.map((s) => ({
    ...s,
    editorId: newEditorId(),
    lines: s.lines.map((l) => ({ ...l, editorId: newEditorId() })),
  }));

const stripContacts = (contacts: EditableContact[]): ContactItem[] =>
  contacts.map((c) => ({ label: c.label, value: c.value }));

const stripPaymentMethods = (
  methods: EditablePaymentMethod[],
): PaymentMethod[] =>
  methods.map((m) => ({ label: m.label, detail: m.detail }));

const stripHours = (hours: EditableHoursSchedule[]): HoursSchedule[] =>
  hours.map((s) => ({
    label: s.label,
    note: s.note,
    lines: s.lines.map((l) => ({
      days: l.days,
      opens: l.opens,
      closes: l.closes,
      note: l.note,
    })),
  }));

// Underline style for the sub-tab level, distinct from the pill-style
// top-level Profil/Dokumen tabs in KnowledgePage — two stacked pill bars
// would blur the hierarchy; pill (outer) + underline (inner) reads clearly
const subTabTriggerClass =
  "w-full h-auto px-0.5 py-3 sm:py-2 sm:pb-2.5 !text-[13px] font-medium text-(--color-text-500) " +
  "rounded-none border-0 border-b-2 border-(--color-border) sm:border-transparent bg-transparent shadow-none " +
  "transition-all duration-150 " +
  "hover:text-brand hover:bg-(--color-bg-page)/60 " +
  "data-[state=active]:!border-b-2 data-[state=active]:border-(--color-brand) " +
  "data-[state=active]:bg-brand/5 data-[state=active]:text-(--color-brand-dark) " +
  "data-[state=active]:font-semibold data-[state=active]:shadow-none";

const ProfileForm = ({
  isAdmin,
  initialProfile,
  initialSections,
  plan,
}: ProfileFormProps) => {
  const [about, setAbout] = useState(initialProfile.about ?? "");
  const [address, setAddress] = useState(initialProfile.address ?? "");
  const [contacts, setContacts] = useState<EditableContact[]>(() =>
    toEditableContacts(initialProfile.contacts),
  );
  const [hours, setHours] = useState<EditableHoursSchedule[]>(() =>
    toEditableHours(initialProfile.hours),
  );
  const [paymentMethods, setPaymentMethods] = useState<EditablePaymentMethod[]>(
    () => toEditablePaymentMethods(initialProfile.paymentMethods),
  );
  // Lifted out of KnowledgeSectionsPanel — a naive tab switch would
  // otherwise remount it back to initialSections and silently hide
  // whatever was just added/edited until a full page reload
  const [sections, setSections] =
    useState<KnowledgeSectionRow[]>(initialSections);

  const [subTab, setSubTab] = useState<ManualSubTab>("identitas");
  const [isPending, startTransition] = useTransition();

  const identityComplete =
    about.trim().length > 0 && address.trim().length > 0 && contacts.length > 0;

  const totalKnowledgeEntries = useMemo(
    () => sections.reduce((sum, s) => sum + s.entries.length, 0),
    [sections],
  );

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveBusinessProfile({
        about,
        address,
        contacts: stripContacts(contacts),
        hours: stripHours(hours),
        paymentMethods: stripPaymentMethods(paymentMethods),
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

  // One save action, rendered per sub-tab — clicking it from any of the
  // three form tabs saves the full profile object regardless of which
  // tab is active, since it's all one row in the DB. Expected, not a bug.
  const saveBar = isAdmin && (
    <div className="flex flex-col items-stretch gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] leading-relaxed text-(--color-text-400)">
        Perubahan berlaku setelah disimpan dan diproses ulang oleh KUN.
      </p>
      <Button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="btn-brand w-full sm:w-auto sm:min-w-[120px] text-[13.5px]"
        aria-busy={isPending}
      >
        {isPending ? "Menyimpan..." : "Simpan"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4 sm:px-1.5 pb-5">
      {!isAdmin && (
        <div className="px-4 py-3 rounded-(--radius-sm) bg-(--color-bg-page) 
          border border-(--color-border) text-[12.5px] text-(--color-text-500)"
        >
          Hubungi admin untuk mengubah profil bisnis. Kamu masih bisa melihat
          info di bawah.
        </div>
      )}

      <Tabs
        value={subTab}
        onValueChange={(value) => setSubTab(value as ManualSubTab)}
        className="mt-5"
      >
        <TabsList className="grid w-full grid-cols-2 items-end justify-start sm:gap-x-4 gap-y-0 
          h-auto p-0 bg-transparent sm:border-b-2 sm:border-(--color-border) rounded-none sm:flex sm:gap-6"
        >
          <TabsTrigger value="identitas" className={subTabTriggerClass}>
            Identitas & Kontak
          </TabsTrigger>
          <TabsTrigger value="jam" className={subTabTriggerClass}>
            Jam Operasional
          </TabsTrigger>
          <TabsTrigger value="pembayaran" className={`!border-b-0 ${subTabTriggerClass}`}>
            Metode Pembayaran
          </TabsTrigger>
          <TabsTrigger value="katalog" className={`!border-b-0 ${subTabTriggerClass}`}>
            <span className="flex items-center gap-1.5">
              Katalog & FAQ
              {totalKnowledgeEntries > 0 && (
                <span className="text-[10px] font-bold bg-(--color-bg-page) text-(--color-text-500) px-1.5 py-0.5 rounded-full">
                  {totalKnowledgeEntries}
                </span>
              )}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="identitas" className="mt-18 sm:mt-5">
          <NumberedSection
            icon={<Store className="h-4 w-4" />}
            title="Identitas & Kontak"
            description="Info dasar yang membantu KUN memperkenalkan bisnismu dan menjawab pertanyaan lokasi/kontak."
            action={
              identityComplete && (
                <span className="w-fit text-[11px] font-medium text-(--color-brand-dark) bg-(--color-brand-light) 
                  border border-(--color-brand-mid) px-2 py-0.5 rounded-(--radius-xs)"
                >
                  Lengkap
                </span>
              )
            }
          >
            <div className="space-y-5">
              <div>
                <div className="flex flex-col gap-0.5 mb-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <label className="block text-[12.5px] font-semibold text-(--color-text-700)">
                    Tentang Bisnis & Deskripsi
                  </label>
                  <span className="text-[11px] text-(--color-text-400)">
                    Membantu KUN merangkum siapa kamu
                  </span>
                </div>
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
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-(--color-text-700) mb-1.5">
                  Alamat Lengkap & Patokan Lokasi
                </label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Contoh: Jl. Merdeka No. 12, Balikpapan"
                  maxLength={300}
                  disabled={!isAdmin}
                  className="input-base"
                  aria-label="Alamat bisnis"
                />
                <p className="mt-1 text-[11px] text-(--color-text-400)">
                  Alamat ini akan otomatis dibagikan KUN ketika pelanggan
                  menanyakan lokasi atau jadwal kedatangan.
                </p>
              </div>

              <div className="pt-2 border-t border-(--color-border-sm)">
                <label className="block text-[12.5px] font-semibold text-(--color-text-700) mb-2">
                  Kontak Layanan Utama
                </label>
                <ContactsEditor
                  contacts={contacts}
                  onChange={setContacts}
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </NumberedSection>
          {saveBar}
        </TabsContent>

        <TabsContent value="jam" className="mt-18 sm:mt-5">
          <NumberedSection
            icon={<Clock className="h-4 w-4" />}
            title="Jam Operasional"
            description="Bisa lebih dari satu jadwal — misalnya jadwal klinik dan jadwal darurat yang berbeda."
          >
            <HoursEditor
              hours={hours}
              onChange={setHours}
              disabled={!isAdmin}
            />
          </NumberedSection>
          {saveBar}
        </TabsContent>

        <TabsContent value="pembayaran" className="mt-18 sm:mt-5">
          <NumberedSection
            icon={<CreditCard className="h-4 w-4" />}
            title="Metode Pembayaran"
            description="Cara pelanggan bisa membayar — QRIS, transfer bank, tunai, dan sebagainya."
          >
            <PaymentMethodsEditor
              methods={paymentMethods}
              onChange={setPaymentMethods}
              disabled={!isAdmin}
            />
          </NumberedSection>
          {saveBar}
        </TabsContent>

        <TabsContent value="katalog" className="mt-18 sm:mt-5">
          <NumberedSection
            icon={<BookOpen className="h-4 w-4" />}
            title="Katalog & FAQ"
            description="Menu, harga, kebijakan, promo, dan pertanyaan umum — tersimpan otomatis begitu kamu klik Simpan di masing-masing item."
          >
            <KnowledgeSectionsPanel
              isAdmin={isAdmin}
              sections={sections}
              onSectionsChange={setSections}
              plan={plan}
            />
          </NumberedSection>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfileForm;
