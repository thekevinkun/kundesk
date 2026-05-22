"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { requireOrg } from "@/lib/auth";
import type { ActionResult } from "@/types/api";

// ── Types ──

export interface TeamMember {
  // Clerk membership ID — used for role change and removal
  membershipId: string;
  // Clerk user ID
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  // Avatar image URL from Clerk — may be null
  imageUrl: string | null;
  // "org:admin" | "org:member"
  role: string;
  // ISO string of when they joined the org
  joinedAt: string;
}

export type TeamRole = "org:admin" | "org:member";

// ── Get all members ──
export async function getTeamMembers(): Promise<TeamMember[]> {
  const { orgId } = await requireOrg();
  const client = await clerkClient();

  const list = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    // Fetch up to 100 members — sufficient for SME target market
    limit: 100,
  });

  // Map Clerk membership shape to our TeamMember type
  return list.data.map((m) => ({
    membershipId: m.id,
    userId: m.publicUserData?.userId ?? "",
    firstName: m.publicUserData?.firstName ?? null,
    lastName: m.publicUserData?.lastName ?? null,
    // Identifier is always the primary email
    email: m.publicUserData?.identifier ?? "",
    imageUrl: m.publicUserData?.imageUrl ?? null,
    role: m.role,
    joinedAt: new Date(m.createdAt).toISOString(),
  }));
}

// ── Invite member by email ──
export async function inviteMember(rawInput: unknown): Promise<ActionResult> {
  const { orgId, userId } = await requireOrg();
  const client = await clerkClient();

  // Only admins can invite
  const { data: membershipData } =
    await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      userId: [userId],
      limit: 1,
    });
  if (!membershipData[0] || membershipData[0].role !== "org:admin") {
    return {
      success: false,
      error: "Hanya admin yang dapat mengundang anggota.",
    };
  }

  // Validate input shape
  if (
    typeof rawInput !== "object" ||
    rawInput === null ||
    typeof (rawInput as Record<string, unknown>).email !== "string" ||
    typeof (rawInput as Record<string, unknown>).role !== "string"
  ) {
    return { success: false, error: "Input tidak valid." };
  }

  const { email, role } = rawInput as { email: string; role: string };

  // Only allow valid roles
  if (role !== "org:admin" && role !== "org:member") {
    return { success: false, error: "Role tidak valid." };
  }

  try {
    await client.organizations.createOrganizationInvitation({
      organizationId: orgId,
      // The user who is sending the invitation
      inviterUserId: userId,
      emailAddress: email,
      role: role as TeamRole,
      // Redirect after accepting invite
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    });

    return { success: true, data: undefined };
  } catch (err: unknown) {
    // Clerk throws when email already a member or invite already pending
    const message =
      err instanceof Error ? err.message : "Gagal mengirim undangan.";
    return { success: false, error: message };
  }
}

// ── Change member role ──
export async function changeMemberRole(
  rawInput: unknown,
): Promise<ActionResult> {
  const { orgId, userId } = await requireOrg();
  const client = await clerkClient();

  // Only admins can change roles
  const { data: membershipData } =
    await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      userId: [userId],
      limit: 1,
    });
  if (!membershipData[0] || membershipData[0].role !== "org:admin") {
    return { success: false, error: "Hanya admin yang dapat mengubah role." };
  }

  if (
    typeof rawInput !== "object" ||
    rawInput === null ||
    typeof (rawInput as Record<string, unknown>).membershipId !== "string" ||
    typeof (rawInput as Record<string, unknown>).role !== "string"
  ) {
    return { success: false, error: "Input tidak valid." };
  }

  const { membershipId, role, targetUserId } = rawInput as {
    membershipId: string;
    role: string;
    targetUserId: string;
  };

  if (role !== "org:admin" && role !== "org:member") {
    return { success: false, error: "Role tidak valid." };
  }

  // Prevent self-demotion — org needs at least one admin
  if (membershipData[0].id === membershipId && role === "org:member") {
    return {
      success: false,
      error: "Kamu tidak bisa menurunkan role diri sendiri.",
    };
  }

  try {
    await client.organizations.updateOrganizationMembership({
      organizationId: orgId,
      userId: targetUserId,
      role: role as TeamRole,
    });

    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengubah role.";
    return { success: false, error: message };
  }
}

// ── Remove member ──
export async function removeMember(rawInput: unknown): Promise<ActionResult> {
  const { orgId, userId } = await requireOrg();
  const client = await clerkClient();

  // Only admins can remove members
  const { data: membershipData } =
    await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      userId: [userId],
      limit: 1,
    });
  if (!membershipData[0] || membershipData[0].role !== "org:admin") {
    return {
      success: false,
      error: "Hanya admin yang dapat menghapus anggota.",
    };
  }

  if (
    typeof rawInput !== "object" ||
    rawInput === null ||
    typeof (rawInput as Record<string, unknown>).userId !== "string"
  ) {
    return { success: false, error: "Input tidak valid." };
  }

  const { userId: targetUserId } = rawInput as { userId: string };

  // Prevent self-removal
  if (targetUserId === userId) {
    return {
      success: false,
      error: "Kamu tidak bisa menghapus diri sendiri dari tim.",
    };
  }

  try {
    await client.organizations.deleteOrganizationMembership({
      organizationId: orgId,
      userId: targetUserId,
    });

    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menghapus anggota.";
    return { success: false, error: message };
  }
}
