"use client";

import { useAuth } from "@clerk/nextjs";
import type { TeamMember } from "@/lib/actions/team";
import { ROLE_CONFIG, getInitials, getAvatarColor } from "./constants";

interface MemberRowProps {
  member: TeamMember;
  // Index used for avatar color cycling
  index: number;
  // Whether the current user is an admin — controls action visibility
  isCurrentUserAdmin: boolean;
  onRoleChange: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
}

const MemberRow = ({
  member,
  index,
  isCurrentUserAdmin,
  onRoleChange,
  onRemove,
}: MemberRowProps) => {
  const { userId } = useAuth();

  // Derive display name — fall back to email prefix if no name set
  const displayName =
    member.firstName || member.lastName
      ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
      : member.email.split("@")[0];

  // Is this row the currently logged-in user?
  const isSelf = member.userId === userId;

  const roleConfig = ROLE_CONFIG[member.role] ?? ROLE_CONFIG["org:member"]!;
  const avatarColor = getAvatarColor(index);
  const initials = getInitials(member.firstName, member.lastName, member.email);

  // Format join date — e.g. "Mei 2026"
  const joinedFormatted = new Date(member.joinedAt).toLocaleDateString(
    "id-ID",
    { month: "long", year: "numeric" },
  );

  return (
    <div className="flex items-center gap-4 p-4 rounded-(--radius-md) bg-(--color-bg-card) border border-(--color-border) shadow-(--shadow-sm) transition-shadow hover:shadow-(--shadow-md)">
      {/* ── Avatar ── */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0"
        style={{
          backgroundColor: avatarColor.bg,
          color: avatarColor.text,
        }}
        aria-hidden="true"
      >
        {member.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.imageUrl}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* ── Name + email ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-600 text-(--color-text-900) truncate">
            {displayName}
          </span>

          {/* "Kamu" pill — only shown on the current user's row */}
          {isSelf && (
            <span className="badge-base badge-neutral text-[10px]">Kamu</span>
          )}
        </div>

        <div className="text-[12px] text-(--color-text-400) truncate mt-0.5">
          {member.email}
        </div>
      </div>

      {/* ── Role badge ── */}
      <div className="flex-shrink-0 hidden sm:block">
        <span className={roleConfig.badgeClass}>{roleConfig.label}</span>
      </div>

      {/* ── Joined date ── */}
      <div className="flex-shrink-0 hidden md:block text-[12px] text-(--color-text-400) min-w-[80px] text-right">
        Sejak {joinedFormatted}
      </div>

      {/* ── Actions — only visible to admins, hidden on own row for remove ── */}
      {isCurrentUserAdmin && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Role change — available for all members including self (but server blocks self-demotion) */}
          <button
            onClick={() => onRoleChange(member)}
            className="text-[12px] font-600 text-(--color-text-500) hover:text-(--color-brand) transition-colors px-2 py-1 rounded-(--radius-xs) hover:bg-(--color-brand-light)"
            aria-label={`Ubah role ${displayName}`}
          >
            Ubah Role
          </button>

          {/* Remove — hidden on own row, can't remove yourself */}
          {!isSelf && (
            <button
              onClick={() => onRemove(member)}
              className="text-[12px] font-600 text-(--color-text-500) hover:text-(--color-danger) transition-colors px-2 py-1 rounded-(--radius-xs) hover:bg-(--color-danger-bg)"
              aria-label={`Hapus ${displayName} dari tim`}
            >
              Hapus
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MemberRow;
