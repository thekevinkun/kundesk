"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TeamMember } from "@/lib/actions/team";
import { changeMemberRole } from "@/lib/actions/team";
import { ROLE_CHANGE_COPY, ROLE_OPTIONS, ROLE_CONFIG } from "./constants";

interface RoleChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  onChanged: () => void;
}

const RoleChangeDialog = ({
  open,
  onOpenChange,
  member,
  onChanged,
}: RoleChangeDialogProps) => {
  const [selectedRole, setSelectedRole] = useState("");
  const [isPending, startTransition] = useTransition();

  // Sync selected role when member changes — so dialog opens with current role
  useEffect(() => {
    if (member) setSelectedRole(member.role);
  }, [member]);

  if (!member) return null;

  const displayName =
    member.firstName || member.lastName
      ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
      : member.email;

  // No change made — disable confirm button
  const isUnchanged = selectedRole === member.role;

  const handleConfirm = () => {
    if (isUnchanged) return;

    startTransition(async () => {
      const result = await changeMemberRole({
        membershipId: member.membershipId,
        targetUserId: member.userId,
        role: selectedRole,
      });

      if (result.success) {
        const newRoleLabel = ROLE_CONFIG[selectedRole]?.label ?? selectedRole;
        toast.success("Role diperbarui", {
          description: `${displayName} sekarang menjadi ${newRoleLabel}.`,
        });
        onOpenChange(false);
        onChanged();
      } else {
        toast.error("Gagal mengubah role", {
          description: result.error,
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{ROLE_CHANGE_COPY.title}</DialogTitle>
          <DialogDescription>
            Ubah role untuk{" "}
            <span className="font-600 text-(--color-text-900)">
              {displayName}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        {/* Role selector with description */}
        <div className="py-2 flex flex-col gap-2">
          {ROLE_OPTIONS.map((opt) => {
            const config = ROLE_CONFIG[opt.value]!;
            const isSelected = selectedRole === opt.value;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedRole(opt.value)}
                className={[
                  "w-full text-left p-3 rounded-(--radius-sm) border transition-all",
                  isSelected
                    ? "border-(--color-brand) bg-(--color-brand-light)"
                    : "border-(--color-border) hover:border-(--color-brand-mid) hover:bg-(--color-bg-page)",
                ].join(" ")}
                aria-pressed={isSelected}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[13px] font-600 ${isSelected ? "text-(--color-brand-dark)" : "text-(--color-text-900)"}`}
                  >
                    {config.label}
                  </span>
                  {/* Checkmark on selected role */}
                  {isSelected && (
                    <span
                      className="text-(--color-brand) text-[14px]"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  )}
                </div>
                <p
                  className={`text-[12px] leading-relaxed ${isSelected ? "text-(--color-brand-dark)/70" : "text-(--color-text-400)"}`}
                >
                  {config.description}
                </p>
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {ROLE_CHANGE_COPY.cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || isUnchanged}
            className="btn-brand"
            aria-busy={isPending}
          >
            {isPending ? "Menyimpan..." : ROLE_CHANGE_COPY.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RoleChangeDialog;
