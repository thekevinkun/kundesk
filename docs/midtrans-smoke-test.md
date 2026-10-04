# Midtrans smoke test

Run this against the **sandbox** after any change to the payment path, and run the
production section once when real keys are approved. Everything here is safe to run:
no command prints a key, and the sandbox moves no real money.

## Rules for every command

- Never run `source .env.local` — it echoes lines containing `&` (the database password was
  printed once this way). Read single values with `grep '^NAME=' .env.local | cut -d= -f2-`.
- Never paste a key, a signature or a connection string into chat or a PR.
- Run `unset KEY` after any command that loads the server key into a shell variable.

## Setup

Start `npm run dev` and use a TEST org only. `KUNDESK_PAYMENT_MODE` must be `midtrans`.

## Scenarios

| #   | Scenario              | How                                                                                                      | Expected                                                                                  |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Normal payment        | Billing → upgrade → pay with QRIS in the Midtrans simulator                                              | Plan switches, bell notification appears, upgrade email arrives, history row is `success` |
| 2   | Replayed notification | Send a validly signed settlement for an already-paid order (see "Signed request" below)                  | `200 "Already processed"`, plan unchanged                                                 |
| 3   | Tampered signature    | Same request with a wrong `signature_key`                                                                | `401 "Invalid signature"`                                                                 |
| 4   | Wrong amount          | Create a checkout, do NOT pay, then send a validly signed settlement with a different `gross_amount`     | `200 "Amount mismatch — flagged for review"`, plan unchanged, Sentry error                |
| 5   | Unknown order         | Send a validly signed settlement for `KUNDESK-org_NOPE0000-STARTER-1`                                    | `200 "No checkout record — flagged for review"` (real mode), Sentry error                 |
| 6   | Cancel                | Create a checkout, click Batalkan                                                                        | Row becomes `cancelled`, the old Snap link no longer works                                |
| 7   | Declined, then paid   | Pay with a deny test card from Midtrans's sandbox test-card page, then pay the same order another way    | Order stays pending after the decline, activates after the second attempt                 |
| 8   | Lost webhook          | Reset an order to `pending` and delete its `processed_webhooks` row, then run the reconcile cron (below) | `"recovered":1`, plan restored; a second run says `"checked":0`                           |
| 9   | Expired checkout      | Leave a checkout unpaid for 24 hours, or expire it from the sandbox dashboard if it offers that          | Row becomes `expired`, cron finds nothing to recover                                      |

## Signed request (scenarios 2, 3, 4, 5)

A valid signature is `SHA512(order_id + status_code + gross_amount + server_key)`. Edit only
the three variables at the top:

```bash
   ORDER='KUNDESK-org_XXXXXXXX-STARTER-0000000000000'
   AMOUNT='99000.00'
   STATUS='settlement'
   KEY=$(grep '^MIDTRANS_SERVER_KEY=' .env.local | cut -d= -f2-)
   SIG=$(printf '%s' "${ORDER}200${AMOUNT}${KEY}" | openssl dgst -sha512 | awk '{print $NF}')
   curl -s -X POST http://localhost:3000/api/webhooks/midtrans \
     -H 'Content-Type: application/json' \
     -d "{\"order_id\":\"${ORDER}\",\"status_code\":\"200\",\"gross_amount\":\"${AMOUNT}\",\"transaction_status\":\"${STATUS}\",\"fraud_status\":\"accept\",\"payment_type\":\"qris\",\"signature_key\":\"${SIG}\"}"
   unset KEY SIG
```

For scenario 3, replace `${SIG}` in the `-d` body with the text `wrong`.

## Reconcile cron (scenario 8)

```bash
   curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)" http://localhost:3000/api/cron/payment-reconcile
```

Output shape: `{"checked":N,"recovered":N,"flagged":N,"errors":N,"expiredPayments":N}`.

## When production keys are approved (do these once, in order)

1.  Put the production keys in Vercel's **Production** scope only. Never in Preview.
2.  Set `MIDTRANS_IS_PRODUCTION=true`. A mismatch (production flag with `SB-` keys, swapped
    keys, whitespace, a missing key) now fails the build on purpose.
3.  Check the keys work against production. Edit nothing — the order id is made up:

```bash
      KEY=$(grep '^MIDTRANS_SERVER_KEY=' .env.production.local | cut -d= -f2-)
      curl -s -u "$KEY:" https://api.midtrans.com/v2/KUNDESK-NOPE0000-STARTER-1/status
      unset KEY
```

      Expected: `"status_code":"404"` ("Transaction doesn't exist"). `"status_code":"401"` means
      the key is not valid for production. **Not yet verified:** this is how the sandbox
      endpoint behaved; check it the first time against production.

4.  In the Midtrans dashboard, set the production notification URL to
    `https://<your-domain>/api/webhooks/midtrans`. Sandbox and production have separate settings.
5.  Confirm the Resend sender is on the owned domain (rule 170).
6.  Make one real, smallest-possible payment and confirm scenario 1 end to end.
7.  Check that Sentry delivers the `midtrans webhook:` and `payment-reconcile:` messages to
    someone who will read them.
