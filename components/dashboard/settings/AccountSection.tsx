"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ConfigSection } from "@/components/dashboard/settings";
import type { PlanBadge } from "@/components/dashboard/settings/constants";

interface AccountSectionProps {
  ownerEmail: string | null;
  subscriptionStatus: string;
  planBadge: PlanBadge;
}

const AccountSection = ({
  ownerEmail,
  subscriptionStatus,
  planBadge,
}: AccountSectionProps) => {
  return (
    <ConfigSection
      title="Informasi Akun"
      description="Detail akun dan plan yang sedang aktif."
    >
      <div className="space-y-4">
        <div>
          <Label className="text-[13px] font-semibold text-(--color-text-700) mb-1.5 block">
            Email Pemilik
          </Label>

          <Input
            value={ownerEmail ?? "—"}
            readOnly
            className="input-base bg-(--color-bg-page) text-(--color-text-500) cursor-default"
            aria-label="Email pemilik akun — tidak dapat diubah"
          />

          <p className="text-[11.5px] text-(--color-text-400) mt-1">
            Email ini digunakan untuk notifikasi tagihan dan sistem. Ubah
            melalui akun Clerk kamu.
          </p>
        </div>

        <div>
          <Label className="text-[13px] font-semibold text-(--color-text-700) mb-1.5 block">
            Plan Aktif
          </Label>

          <div className="flex items-center gap-3">
            <Badge className={planBadge.className}>{planBadge.label}</Badge>

            {subscriptionStatus === "past_due" && (
              <Badge className="badge-warning">Tagihan Tertunggak</Badge>
            )}

            {subscriptionStatus === "suspended" && (
              <Badge className="badge-danger">Suspended</Badge>
            )}

            <Link
              href="/dashboard/billing"
              className="text-[12.5px] font-semibold text-(--color-brand) hover:text-(--color-brand-dark) transition-colors ml-auto"
            >
              Kelola Billing →
            </Link>
          </div>
        </div>
      </div>
    </ConfigSection>
  );
};

export default AccountSection;
