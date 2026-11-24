// The one place that turns a price and a promo percent into the amount to charge.
// Used by checkout (createPayment) and by the plan cards, so they can never disagree.
// Integer math on purpose: price * (100 - percent) is a whole number, so floor(/100) has no float error.
export function applyPromoDiscount(price: number, percent: number): number {
  return Math.floor((price * (100 - percent)) / 100);
}
