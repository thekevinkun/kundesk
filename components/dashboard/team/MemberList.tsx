"use client";

import { motion } from "framer-motion";
import { MemberRow } from "./";
import type { TeamMember } from "@/lib/actions/team";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { EMPTY_STATE } from "./constants";

interface MemberListProps {
  members: TeamMember[];
  isCurrentUserAdmin: boolean;
  onRoleChange: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
}

const MemberList = ({
  members,
  isCurrentUserAdmin,
  onRoleChange,
  onRemove,
}: MemberListProps) => {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center card-base">
        <span className="text-[40px] mb-4" aria-hidden="true">
          👥
        </span>
        <p className="text-[14px] font-600 text-(--color-text-900) mb-1">
          {EMPTY_STATE.title}
        </p>
        <p className="text-[13px] text-(--color-text-400) max-w-[320px] leading-relaxed">
          {EMPTY_STATE.description}
        </p>
      </div>
    );
  }

  return (
    // Stagger each member row in on mount
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-3"
      // Announce member count to screen readers
      aria-label={`${members.length} anggota tim`}
    >
      {members.map((member, index) => (
        <motion.div key={member.membershipId} variants={staggerItem}>
          <MemberRow
            member={member}
            index={index}
            isCurrentUserAdmin={isCurrentUserAdmin}
            onRoleChange={onRoleChange}
            onRemove={onRemove}
          />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default MemberList;
