"use client";

import { useState, useCallback, useTransition } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  MemberList,
  InviteCard,
  RoleChangeDialog,
  RemoveMemberDialog,
} from "./team";
import { getTeamMembers } from "@/lib/actions/team";
import type { TeamMember } from "@/lib/actions/team";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/animations";
import { PAGE_HEADER } from "./team/constants";

interface TeamPageProps {
  // Initial members fetched server-side — no loading flash
  initialMembers: TeamMember[];
  // Current user's role — passed from server so we don't need extra client fetch
  currentUserRole: string;
}

const TeamPage = ({ initialMembers, currentUserRole }: TeamPageProps) => {
  // Local member list — refreshed after mutations without full page reload
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);

  // Member targeted for role change dialog
  const [roleChangeMember, setRoleChangeMember] = useState<TeamMember | null>(
    null,
  );

  // Member targeted for removal dialog
  const [removeMember, setRemoveMember] = useState<TeamMember | null>(null);

  // useTransition for background refresh after mutations
  const [, startRefresh] = useTransition();

  // Current user is admin if their role is org:admin
  const isCurrentUserAdmin = currentUserRole === "org:admin";

  // Refresh member list from server after any mutation
  const refreshMembers = useCallback(() => {
    startRefresh(async () => {
      try {
        const updated = await getTeamMembers();
        setMembers(updated);
      } catch {
        toast.error("Gagal memuat ulang daftar anggota.");
      }
    });
  }, []);

  return (
    <>
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="max-w-4xl mx-auto"
      >
        {/* ── Page header ── */}
        <div className="mb-6">
          <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
            {PAGE_HEADER.title}
          </h1>
          <p className="text-[13px] text-(--color-text-500) mt-1">
            {PAGE_HEADER.description}
          </p>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {/* ── Member count strip ── */}
          <motion.div
            variants={staggerItem}
            className="flex items-center justify-between"
          >
            <span className="text-[13px] font-600 text-(--color-text-700)">
              {members.length} anggota
            </span>

            {/* Role badge for current user */}
            <span className="text-[12px] text-(--color-text-400)">
              Role kamu:{" "}
              <span className="font-600 text-(--color-brand)">
                {currentUserRole === "org:admin" ? "Admin" : "Anggota"}
              </span>
            </span>
          </motion.div>

          {/* ── Invite card — admin only ── */}
          {isCurrentUserAdmin && (
            <motion.div variants={staggerItem}>
              <InviteCard onInvited={refreshMembers} />
            </motion.div>
          )}

          {/* ── Member list ── */}
          <motion.div variants={staggerItem}>
            <MemberList
              members={members}
              isCurrentUserAdmin={isCurrentUserAdmin}
              onRoleChange={setRoleChangeMember}
              onRemove={setRemoveMember}
            />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* ── Dialogs — rendered outside layout flow ── */}
      <RoleChangeDialog
        open={!!roleChangeMember}
        onOpenChange={(open) => !open && setRoleChangeMember(null)}
        member={roleChangeMember}
        onChanged={refreshMembers}
      />

      <RemoveMemberDialog
        open={!!removeMember}
        onOpenChange={(open) => !open && setRemoveMember(null)}
        member={removeMember}
        onRemoved={refreshMembers}
      />
    </>
  );
};

export default TeamPage;
