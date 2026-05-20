"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";
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
import { updateOrgProfile, deleteOrg } from "@/lib/actions/settings";
import type { ActionResult } from "@/types/api";

export interface OrgSettings {
  name: string;
  slug: string;
  ownerEmail: string | null;
  plan: string;
  subscriptionStatus: string;
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

const SettingsPage = ({ settings }: { settings: OrgSettings }) => {
  // Clerk client used for signing user out after deletion
  const { signOut } = useClerk();

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

  // Handles profile update server action state
  const [profileState, profileDispatch, isProfilePending] = useActionState(
    profileAction,
    null,
  );

  // Handles organization deletion server action state
  const [deleteState, deleteDispatch] = useActionState(deleteAction, null);

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

  // Trigger permanent organization deletion
  const handleDeleteConfirm = () => {
    setIsDeleting(true);

    deleteDispatch();
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

      // Close modal even if request failed
      setSlugModalOpen(false);
    } else {
      toast.error("Gagal menyimpan", {
        description: profileState.error,
      });

      // Close confirmation modal after successful save
      setSlugModalOpen(false);
    }
  }, [profileState]);

  // Handle post-deletion flow
  useEffect(() => {
    if (!deleteState) return;

    if (deleteState.success) {
      // Organization already deleted → sign user out
      signOut({
        redirectUrl: "/sign-in",
      });
    } else {
      toast.error("Gagal menghapus akun", {
        description: deleteState.error,
      });

      setIsDeleting(false);

      setDeleteModalOpen(false);
    }
  }, [deleteState, signOut]);

  // Resolve plan badge UI with fallback
  const planBadge = PLAN_BADGE[settings.plan] ?? PLAN_BADGE["free"]!;

  // Delete button enabled only if org name matches exactly
  const isDeletionConfirmed = deleteConfirmText === settings.name;

  return (
    <>
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="max-w-3xl mx-auto"
      >
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
            <DangerZoneSection onDeleteClick={() => setDeleteModalOpen(true)} />
          </motion.div>
        </form>
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

      {/* Permanent organization deletion modal */}
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
