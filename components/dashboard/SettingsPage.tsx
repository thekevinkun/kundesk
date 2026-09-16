"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ProfileSection,
  AccountSection,
  DangerZoneSection,
  SlugChangeDialog,
  DeleteOrgDialog,
} from "@/components/dashboard/settings";
import { PLAN_BADGE } from "@/components/dashboard/settings/constants";
import { fadeUp, staggerContainer } from "@/lib/animations";
import {
  updateOrgProfile,
  deleteOrg,
  cancelOrgDeletion,
} from "@/lib/actions/settings";
import type { ActionResult } from "@/types/api";

export interface OrgSettings {
  name: string;
  slug: string;
  ownerEmail: string | null;
  plan: string;
  subscriptionStatus: string;
  // Null = no deletion pending. Set = grace period in progress.
  deletionRequestedAt: Date | null;
}

const profileAction = async (
  _prev: ActionResult<{ slug: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ slug: string }>> => {
  return updateOrgProfile({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
};

const deleteAction = async (
  _prev: ActionResult | null,
): Promise<ActionResult> => {
  return deleteOrg();
};

const cancelDeleteAction = async (
  _prev: ActionResult | null,
): Promise<ActionResult> => {
  return cancelOrgDeletion();
};

// 30-day grace period — matches GRACE_PERIOD_DAYS in the org-purge cron
const GRACE_PERIOD_DAYS = 30;

const SettingsPage = ({ settings }: { settings: OrgSettings }) => {
  // Controlled form state
  const [name, setName] = useState(settings.name);
  const [slug, setSlug] = useState(settings.slug);

  // Slug confirmation modal state
  const [slugModalOpen, setSlugModalOpen] = useState(false);

  // Temporarily stores form data until slug change is confirmed
  const pendingFormRef = useRef<FormData | null>(null);

  // Delete organization modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // User must type org name before deletion is allowed
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Prevents duplicate delete requests + locks modal UI
  const [isDeleting, setIsDeleting] = useState(false);

  // Prevents duplicate cancel requests
  const [isCancelling, setIsCancelling] = useState(false);

  // Local mirror of deletionRequestedAt — updated optimistically after
  // delete/cancel actions succeed, without needing a full page refetch
  const [deletionRequestedAt, setDeletionRequestedAt] = useState(
    settings.deletionRequestedAt,
  );

  // Handles profile update server action state
  const [profileState, profileDispatch, isProfilePending] = useActionState(
    profileAction,
    null,
  );

  // Handles organization deletion server action state
  const [deleteState, deleteDispatch] = useActionState(deleteAction, null);

  // Handles cancel-deletion server action state
  const [cancelState, cancelDispatch] = useActionState(
    cancelDeleteAction,
    null,
  );

  // Intercepts form submit to confirm slug changes first
  const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const newSlug = formData.get("slug") as string;

    // Slug changed → require confirmation modal
    if (newSlug !== settings.slug) {
      pendingFormRef.current = formData;

      setSlugModalOpen(true);
    } else {
      // No slug change → submit immediately
      profileDispatch(formData);
    }
  };

  // Submit previously stored form data after confirmation
  const handleSlugConfirm = () => {
    if (pendingFormRef.current) {
      profileDispatch(pendingFormRef.current);
    }
  };

  // Schedule organization deletion (30-day grace period, not instant)
  const handleDeleteConfirm = () => {
    if (isDeleting || !isDeletionConfirmed) return;
    setIsDeleting(true);

    deleteDispatch();
  };

  // Cancel a pending deletion
  const handleCancelDeletion = () => {
    if (isCancelling) return;
    setIsCancelling(true);

    cancelDispatch();
  };

  // Auto-format slug into URL-safe format
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = e.target.value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    setSlug(formatted);
  };

  // Show toast feedback after profile update completes
  useEffect(() => {
    if (!profileState) return;

    if (profileState.success) {
      toast.success("Pengaturan disimpan", {
        description: "Profil bisnis kamu sudah diperbarui.",
      });

      setSlugModalOpen(false);
    } else {
      toast.error("Gagal menyimpan", {
        description: profileState.error,
      });

      setSlugModalOpen(false);
    }
  }, [profileState]);

  // Handle post-deletion-request flow — org is NOT deleted here, just
  // scheduled. No sign-out. Just close the modal and show the banner.
  useEffect(() => {
    if (!deleteState) return;

    if (deleteState.success) {
      setDeletionRequestedAt(new Date());
      setDeleteModalOpen(false);
      setDeleteConfirmText("");

      toast.success("Penghapusan dijadwalkan", {
        description:
          "Akun kamu akan dihapus dalam 30 hari. Kamu bisa membatalkannya kapan saja sebelum itu.",
      });
    } else {
      toast.error("Gagal menghapus akun", {
        description: deleteState.error,
      });
    }

    setIsDeleting(false);
  }, [deleteState]);

  // Handle cancel-deletion flow
  useEffect(() => {
    if (!cancelState) return;

    if (cancelState.success) {
      setDeletionRequestedAt(null);

      toast.success("Penghapusan dibatalkan", {
        description: "Akun bisnis kamu tetap aktif seperti biasa.",
      });
    } else {
      toast.error("Gagal membatalkan penghapusan", {
        description: cancelState.error,
      });
    }

    setIsCancelling(false);
  }, [cancelState]);

  // Resolve plan badge UI with fallback
  const planBadge = PLAN_BADGE[settings.plan] ?? PLAN_BADGE["free"]!;

  // Delete button enabled only if org name matches exactly
  const isDeletionConfirmed = deleteConfirmText === settings.name;

  // Formatted purge date for the banner — null when no deletion pending
  const pendingPurgeDate = deletionRequestedAt
    ? (() => {
        const d = new Date(deletionRequestedAt);
        d.setDate(d.getDate() + GRACE_PERIOD_DAYS);
        return d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      })()
    : null;

  return (
    <>
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center"
      >
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
              Pengaturan
            </h1>

            <p className="text-[13px] text-(--color-text-500) mt-1">
              Kelola profil bisnis dan informasi akun kamu.
            </p>
          </div>

          {/* Settings form */}
          <form onSubmit={handleProfileSubmit}>
            {/* Controlled slug must still exist in submitted form */}
            <input type="hidden" name="slug" value={slug} />

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-4 max-w-2xl"
            >
              {/* Business profile settings */}
              <ProfileSection
                name={name}
                slug={slug}
                setName={setName}
                handleSlugChange={handleSlugChange}
              />

              {/* Account + billing information */}
              <AccountSection
                ownerEmail={settings.ownerEmail}
                subscriptionStatus={settings.subscriptionStatus}
                planBadge={planBadge}
              />

              {/* Save profile changes */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-[12px] text-(--color-text-400)">
                  Perubahan berlaku langsung setelah disimpan.
                </p>

                <Button
                  type="submit"
                  disabled={isProfilePending}
                  className="btn-brand min-w-[120px]"
                  aria-busy={isProfilePending}
                >
                  {isProfilePending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>

              {/* Destructive actions */}
              <DangerZoneSection
                onDeleteClick={() => setDeleteModalOpen(true)}
                onCancelClick={handleCancelDeletion}
                isCancelling={isCancelling}
                pendingPurgeDate={pendingPurgeDate}
              />
            </motion.div>
          </form>
        </div>
      </motion.div>

      {/* Confirmation modal for public URL changes */}
      <SlugChangeDialog
        open={slugModalOpen}
        onOpenChange={setSlugModalOpen}
        currentSlug={settings.slug}
        newSlug={slug}
        isPending={isProfilePending}
        onConfirm={handleSlugConfirm}
      />

      {/* Deletion request modal — schedules deletion, doesn't delete instantly */}
      <DeleteOrgDialog
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        orgName={settings.name}
        confirmText={deleteConfirmText}
        setConfirmText={setDeleteConfirmText}
        isDeleting={isDeleting}
        isConfirmed={isDeletionConfirmed}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
};

export default SettingsPage;
