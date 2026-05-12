import { Separator } from "@/components/ui/separator";
import { PLAN_CONFIG, getStatusDisplay } from "@/helpers/billing";
import { formatDate, formatPaymentMethod } from "@/helpers/format";
import type { BillingPageData } from "@/types/billing";

interface CurrentPlanCardProps {
  data: BillingPageData;
}

const CurrentPlanCard = ({ data }: CurrentPlanCardProps) => {
  const config = PLAN_CONFIG[data.currentPlan];
  const status = getStatusDisplay(data.subscriptionStatus);
  const usagePct =
    data.messagesLimit > 0
      ? Math.min(
          Math.round((data.messagesUsed / data.messagesLimit) * 100),
          100,
        )
      : 0;

  // Usage bar turns red above 90% — visual warning before quota runs out
  const barColor =
    usagePct >= 90 ? "bg-(--color-danger)" : "bg-(--color-brand)";

  return (
    <div className="card-base p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base font-700 text-(--color-text-900) mb-1">
            Plan Saat Ini
          </h2>
          <p className="text-xs text-(--color-text-500)">
            Status langganan dan penggunaan bulan ini
          </p>
        </div>
        {/* Subscription status badge */}
        <span className={status.className}>{status.label}</span>
      </div>

      {/* Plan identity — icon  name + description */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`w-14 h-14 rounded-(--radius-md) ${config.color} flex items-center justify-center text-2xl flex-shrink-0 border border-(--color-border)`}
        >
          {config.icon}
        </div>
        <div>
          <div className="text-2xl font-800 tracking-tight text-(--color-text-900) leading-none mb-1">
            {config.label}
          </div>
          <div className="text-sm text-(--color-text-500)">{config.desc}</div>
        </div>
      </div>

      <Separator className="mb-5" />

      {/* Usage progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-600 text-(--color-text-700)">
            Kuota Pesan
          </span>
          <span className="text-xs text-(--color-text-500)">
            <strong className="text-(--color-text-900) font-700">
              {data.messagesUsed.toLocaleString("id-ID")}
            </strong>{" "}
            / {data.messagesLimit.toLocaleString("id-ID")}
          </span>
        </div>
        <div className="relative h-2 w-full rounded-(--radius-full) bg-(--color-bg-input) border border-(--color-border) overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-(--radius-full) transition-all duration-1000`}
            style={{ width: `${usagePct}%` }}
            role="progressbar"
            aria-valuenow={usagePct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${usagePct}% kuota terpakai`}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-(--color-text-400)">
            Reset:{" "}
            <span className="font-600 text-(--color-text-500)">
              {formatDate(data.currentPeriodEnd)}
            </span>
          </p>
          {/* Urgent warning — only shown above 90% */}
          {usagePct >= 90 && (
            <span className="badge-base badge-danger text-[10px]">
              ⚠ Hampir habis
            </span>
          )}
        </div>
      </div>

      {/* Billing meta — next billing date + last payment method */}
      {data.subscriptionStatus === "active" && (
        <div className="grid grid-cols-2 gap-4 p-4 rounded-(--radius-sm) bg-(--color-bg-page) border border-(--color-border-sm)">
          <div>
            <p className="text-xs text-(--color-text-400) mb-1">
              Tagihan Berikutnya
            </p>
            <p className="text-sm font-600 text-(--color-text-900)">
              {formatDate(data.nextBillingDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-(--color-text-400) mb-1">
              Metode Pembayaran
            </p>
            <p className="text-sm font-600 text-(--color-text-900)">
              {formatPaymentMethod(data.lastPaymentMethod)}
            </p>
          </div>
        </div>
      )}

      {/* Past due warning banner */}
      {data.subscriptionStatus === "past_due" && (
        <div className="mt-4 p-4 rounded-(--radius-sm) bg-(--color-warning-bg) border border-(--color-warning)/30">
          <p className="text-sm font-600 text-(--color-warning)">
            ⚠ Tagihan jatuh tempo
          </p>
          <p className="text-xs text-(--color-warning) mt-1 opacity-80">
            Selesaikan pembayaran sebelum akses Pro dibatasi.
          </p>
        </div>
      )}

      {/* Suspended warning banner */}
      {data.subscriptionStatus === "suspended" && (
        <div className="mt-4 p-4 rounded-(--radius-sm) bg-(--color-danger-bg) border border-(--color-danger)/30">
          <p className="text-sm font-600 text-(--color-danger)">
            🚫 Akun disuspend
          </p>
          <p className="text-xs text-(--color-danger) mt-1 opacity-80">
            Pilih plan di bawah untuk mengaktifkan kembali.
          </p>
        </div>
      )}
    </div>
  );
};

export default CurrentPlanCard;
