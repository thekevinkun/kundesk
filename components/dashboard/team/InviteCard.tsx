"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inviteMember } from "@/lib/actions/team";
import { INVITE_COPY, ROLE_OPTIONS } from "./constants";

interface InviteCardProps {
  // Called after successful invite so parent can refresh member list
  onInvited: () => void;
}

const InviteCard = ({ onInvited }: InviteCardProps) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("org:member");

  // useTransition — keeps UI responsive while server action runs
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    startTransition(async () => {
      const result = await inviteMember({ email: trimmedEmail, role });

      if (result.success) {
        toast.success("Undangan terkirim", {
          description: `${trimmedEmail} akan mendapat email undangan.`,
        });
        // Reset form after success
        setEmail("");
        setRole("org:member");
        onInvited();
      } else {
        toast.error("Gagal mengirim undangan", {
          description: result.error,
        });
      }
    });
  };

  return (
    <div className="card-base p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-700 text-(--color-text-900) tracking-[-0.02em]">
          {INVITE_COPY.title}
        </h2>
        <p className="text-[12.5px] text-(--color-text-400) mt-1 leading-relaxed">
          {INVITE_COPY.description}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        {/* Email input */}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={INVITE_COPY.emailPlaceholder}
          required
          disabled={isPending}
          className="input-base flex-1"
          aria-label="Email anggota baru"
        />

        {/* Role selector */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={isPending}
          className="input-base w-full sm:w-[140px] cursor-pointer"
          aria-label="Role anggota baru"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <Button
          type="submit"
          disabled={isPending || !email.trim()}
          className="btn-brand whitespace-nowrap"
          aria-busy={isPending}
        >
          {isPending ? INVITE_COPY.pendingLabel : INVITE_COPY.submitLabel}
        </Button>
      </form>
    </div>
  );
};

export default InviteCard;
