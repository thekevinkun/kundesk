"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cancelSubscriptionAction } from "@/lib/actions/billing";
import { PLAN_CONFIG } from "@/helpers/billing";
import type { PlanName } from "@/types/billing";

interface CancelDialogProps {
  currentPlan: PlanName;
}

const CancelDialog = ({ currentPlan }: CancelDialogProps) => {
  const [state, formAction, isPending] = useActionState(
    cancelSubscriptionAction,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Langganan berhasil dibatalkan.");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  // Free plan has no subscription to cancel — render nothing
  if (currentPlan === "free") return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-xs text-(--color-text-400) hover:text-(--color-danger) underline underline-offset-2 transition-colors cursor-pointer">
          Batalkan langganan
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan Langganan?</DialogTitle>
          <DialogDescription>
            Akses ke fitur <strong>{PLAN_CONFIG[currentPlan].label}</strong>{" "}
            akan berhenti setelah periode billing saat ini berakhir. Data kamu
            tetap aman.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <form action={formAction}>
            <Button
              type="submit"
              variant="destructive"
              disabled={isPending}
              className="cursor-pointer"
            >
              {isPending ? "Membatalkan..." : "Ya, batalkan"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelDialog;
