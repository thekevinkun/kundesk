import { formatRupiah, formatDate } from "@/helpers/format";
import { PLAN_LABEL, formatPaymentMethod } from "./constants";
import type { PaymentHistoryItem } from "@/types/billing";

interface PaymentHistoryCardProps {
  history: PaymentHistoryItem[];
}

const PaymentHistoryCard = ({ history }: PaymentHistoryCardProps) => {
  // Empty state — no payments recorded yet
  if (history.length === 0) {
    return (
      <div className="card-base p-6">
        <h2 className="text-base font-semibold text-(--color-text-900) mb-4">
          Riwayat Pembayaran
        </h2>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="text-3xl mb-3" aria-hidden="true">
            🧾
          </span>
          <p className="text-sm font-medium text-(--color-text-700) mb-1">
            Belum ada riwayat pembayaran
          </p>
          <p className="text-xs text-(--color-text-400)">
            Pembayaran akan muncul di sini setelah upgrade plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-base overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-(--color-text-900)">
          Riwayat Pembayaran
        </h2>
        <span className="text-xs text-(--color-text-400)">
          {history.length} transaksi terakhir
        </span>
      </div>

      {/* Table — scrollable on small screens */}
      <div className="overflow-x-auto">
        <table className="w-full" aria-label="Riwayat pembayaran">
          <thead>
            <tr className="border-y border-(--color-border-sm) bg-(--color-bg-page)">
              <th className="px-5 py-2.5 text-left text-[11px] font-bold tracking-[0.08em] uppercase text-(--color-text-400)">
                Tanggal
              </th>
              <th className="px-5 py-2.5 text-left text-[11px] font-bold tracking-[0.08em] uppercase text-(--color-text-400)">
                Plan
              </th>
              <th className="px-5 py-2.5 text-left text-[11px] font-bold tracking-[0.08em] uppercase text-(--color-text-400)">
                Metode
              </th>
              <th className="px-5 py-2.5 text-left text-[11px] font-bold tracking-[0.08em] uppercase text-(--color-text-400)">
                Order ID
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-bold tracking-[0.08em] uppercase text-(--color-text-400)">
                Jumlah
              </th>
              <th className="px-5 py-2.5 text-center text-[11px] font-bold tracking-[0.08em] uppercase text-(--color-text-400)">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map((item, i) => (
              <tr
                key={item.orderId}
                className={`border-b border-(--color-border-sm) last:border-0 transition-colors hover:bg-(--color-bg-page) ${
                  // Subtle alternating background for readability
                  i % 2 === 0 ? "" : "bg-(--color-bg-page)/40"
                }`}
              >
                {/* Date */}
                <td className="px-5 py-3.5 text-[13px] text-(--color-text-700) whitespace-nowrap">
                  {formatDate(item.paidAt)}
                </td>

                {/* Plan badge */}
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-(--color-brand) bg-(--color-brand-light) px-2.5 py-1 rounded-full">
                    {PLAN_LABEL[item.plan]}
                  </span>
                </td>

                {/* Payment method */}
                <td className="px-5 py-3.5 text-[13px] text-(--color-text-700)">
                  {formatPaymentMethod(item.paymentMethod)}
                </td>

                {/* Order ID — monospace, truncated */}
                <td className="px-5 py-3.5">
                  <span
                    className="font-mono text-[11px] text-(--color-text-400) bg-(--color-bg-page) px-2 py-1 rounded-[4px] border border-(--color-border-sm)"
                    title={item.orderId}
                  >
                    {/* Show last 16 chars — the timestamp portion is most unique */}
                    ...{item.orderId.slice(-16)}
                  </span>
                </td>

                {/* Amount — right aligned */}
                <td className="px-5 py-3.5 text-[13px] font-semibold text-(--color-text-900) text-right whitespace-nowrap">
                  {formatRupiah(item.amount)}
                </td>

                {/* Status badge */}
                <td className="px-5 py-3.5 text-center">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full ${
                      item.status === "success"
                        ? "badge-success"
                        : item.status === "pending"
                          ? "badge-warning"
                          : "badge-danger"
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-current"
                      aria-hidden="true"
                    />
                    {item.status === "success"
                      ? "Berhasil"
                      : item.status === "pending"
                        ? "Pending"
                        : "Gagal"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentHistoryCard;
