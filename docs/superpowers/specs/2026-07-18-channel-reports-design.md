# Channel-Grouped Reports (Bulk / Consignment / Agent)

**Date:** 2026-07-18
**Status:** Approved design — ready for implementation planning

## Goal

Make `/reports` clearer by organizing sales/profit reporting **by sales channel**
and removing retail from all reports. Concretely:

1. **Exclude retail** (`transaction_type = 'retail'`) from every sales-based report.
2. Group the money reports under **three channel tabs — Bulk, Consignment, Agent** —
   each containing **Sales · Profit · Daily**.
3. Keep inventory/analysis reports **global** (shared across channels).
4. Fix agent-sale cost tracking so the **Agent Profit** report is accurate
   (new migration + one-time backfill).

Retail is only being *hidden from reports* here — it is not being removed from the
app itself. That is a separate future effort.

## Reporting Universe

All sales-based reports count only these transaction types:

```
REPORTABLE_SALE_TYPES = ['bulk', 'consignment_sale', 'agent_sale']
```

Excluded everywhere:

| Excluded type | Why |
|---|---|
| `retail` | Being removed from reporting (per this spec). |
| `consignment_add` | Consignment hand-off — goods on loan, not a sale (already excluded). |
| (agent assignment) | Agent hand-offs do **not** create a transaction row, so nothing to exclude. |

Channel → transaction type mapping:

| Channel | `transaction_type` filter |
|---|---|
| Bulk | `bulk` |
| Consignment | `consignment_sale` |
| Agent | `agent_sale` |
| Global (Customer/Product/Payment/GL) | `IN REPORTABLE_SALE_TYPES` |

Inventory / Expiry / Stock Movements are **not** sales-based and are unchanged.

## Page Structure — `app/(auth)/reports/page.tsx`

Top-level tab bar:

```
[ Bulk ] [ Consignment ] [ Agent ]   [ Customer ] [ Product ] [ Payment ] [ GL ] [ Inventory ] [ Expiry ] [ Stock ]
   └── nested: Sales · Profit · Daily ──┘         └──────────────── global (shared) tabs ────────────────┘
```

- **Bulk / Consignment / Agent** are channel tabs. Each renders an inner `Tabs`
  with **Sales · Profit · Daily**, passing a `channel` prop to the report components.
- **Customer / Product / Payment / GL** stay global, now scoped to
  `REPORTABLE_SALE_TYPES` (retail excluded).
- **Inventory / Expiry / Stock** unchanged.

### Access control (preserved)

- **Bulk users** (`type === 'bulk'`): see only Inventory / Expiry / Stock.
  All channel tabs (which contain Sales/Profit/Daily) are hidden.
- **Profit** sub-tab is **admin-only** (`admin` / `super admin`) inside every channel.
- **Cashier**: no access to `/reports` (unchanged).
- Everyone else: all channels + globals, minus Profit if not admin.

## Channel-Aware Report Components

`SalesReport`, `ProfitReport`, and `DailySalesSummary` gain an optional
`channel?: 'bulk' | 'consignment' | 'agent'` prop. In the new structure these are
**only rendered inside channel tabs**, so the prop is always supplied; the "no prop"
path defaults to `REPORTABLE_SALE_TYPES` for safety.

Behavior when `channel` is set:

- Query filters `transaction_type = <mapped type>`.
- `SalesReport`'s existing internal transaction-type dropdown (All/retail/bulk) is
  **hidden** — the channel is fixed by the tab.
- `ProfitReport` keeps its **All Sales / Payments Received** basis toggle, scoped to
  the channel.
  - **Consignment & Agent + Payments Received:** these channels do **not** write
    `transaction_payments` rows (collections are tracked on `consignments.balance_due`
    for consignment, and not at all for agents). So "Payments Received" will read
    empty for those channels. Add a caption on the Profit report noting this when
    `channel !== 'bulk'` so it isn't mistaken for a bug.

Global reports get a shared universe filter (no channel prop):

- `CustomerSalesReport`, `ProductPerformanceReport`, `PaymentMethodReport`:
  add `.in('transaction_type', REPORTABLE_SALE_TYPES)`.
- `GLTransactionsReport`: keeps its `payment_type = 'GL'` filter and additionally
  restricts to `REPORTABLE_SALE_TYPES` (so a stray retail GL row can't appear).

Define `REPORTABLE_SALE_TYPES` once in `lib/constants/index.ts` and import it, so
the exclusion rule lives in a single place.

## Agent Cost Fix — New Migration

**Problem:** `record_agent_sale` inserts `transaction_items` **without**
`product_stock_id`, so the Profit report's `stock:product_stock_id(purchase_price)`
join returns null → cost = 0 → agent profit = full revenue.

**Migration `015_agent_sale_track_product_stock.sql`** does two things:

### 1. Redefine `record_agent_sale` (future sales)

Add `product_stock_id` to the `transaction_items` INSERT, sourced from the agent's
assigned lot (`v_agent_item.product_stock_id`, already in scope). No other change to
the function. Affects new agent sales only. Reversible by re-deploying the prior
function body.

### 2. One-time backfill (existing agent sales)

Recover the missing `product_stock_id` for historical `agent_sale` lines using
`batch_no` as the bridge — agent-sale `transaction_items` already store `batch_no`
and `product_id`, and each `product_stocks` lot has `batch_no` + `branch_id`.

**Pre-check (run first, not part of the applied migration) — measures blast radius:**

```sql
-- How many agent-sale lines need backfilling, and how many won't match?
SELECT
  count(*) FILTER (WHERE ps.id IS NOT NULL)            AS will_backfill,
  count(*) FILTER (WHERE ps.id IS NULL)                AS wont_match,
  count(*) FILTER (WHERE ti.batch_no IS NULL)          AS no_batch_no
FROM medwise.transaction_items ti
JOIN medwise.transactions t ON t.id = ti.transaction_id
LEFT JOIN LATERAL (
  SELECT ps.id FROM medwise.product_stocks ps
  WHERE ps.product_id = ti.product_id
    AND ps.batch_no  = ti.batch_no
    AND ps.branch_id = t.branch_id
  ORDER BY ps.id LIMIT 1
) ps ON true
WHERE t.transaction_type = 'agent_sale'
  AND ti.product_stock_id IS NULL;
```

**Backfill UPDATE (in the migration, wrapped in a transaction):**

```sql
UPDATE medwise.transaction_items ti
SET product_stock_id = (
  SELECT ps.id
  FROM medwise.product_stocks ps
  JOIN medwise.transactions t ON t.id = ti.transaction_id
  WHERE ps.product_id = ti.product_id
    AND ps.batch_no  = ti.batch_no
    AND ps.branch_id = t.branch_id
  ORDER BY ps.id
  LIMIT 1
)
WHERE ti.product_stock_id IS NULL
  AND ti.batch_no IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM medwise.transactions t
    WHERE t.id = ti.transaction_id
      AND t.transaction_type = 'agent_sale'
  );
```

**Why `batch_no`, not `agent_items`:** `agent_items.transaction_id` is overwritten on
each sale from that lot, so it only points at the *last* sale — unreliable for a lot
sold across multiple transactions. `batch_no → product_stocks` is a stable,
authoritative link.

### Safety analysis

`transaction_items.product_stock_id` is read in **exactly one place** — the Profit
report cost lookup (`ProfitReport.tsx:100,193`). No stock-restore, return, void, or
money logic reads it (verified: restore logic reads `product_stock_id` from
`agent_items` / `consignment_items`, never from `transaction_items`). Therefore:

- The backfill **cannot** affect inventory, balances, or financial records.
- The `UPDATE` only touches rows where `product_stock_id IS NULL` — never overwrites
  existing values.
- It writes a valid FK (an existing `product_stocks.id`).
- Idempotent (only fills remaining nulls); fully reversible (set back to `NULL`).

**Residual risk (cost-accuracy only, a few edge rows):**

- Line has no `batch_no`, or its lot was deleted → no match → stays uncosted (cost 0).
- A product+branch has two lots sharing one `batch_no` with different purchase prices
  → ambiguous; deterministically picks the lowest-id lot.

**Precautions:** run the pre-check first; take a Supabase snapshot before applying;
wrap the backfill in a transaction; test on a copy/staging if available.

## Out of Scope (YAGNI)

- Removing retail from the app (POS, transaction creation) — reports-only exclusion here.
- Per-channel splits of Customer / Product / Payment / GL — they stay combined.
- Writing `transaction_payments` rows for consignment/agent collections (would make
  "Payments Received" work for those channels) — noted as a known gap, not built now.
- Any Agent-specific new report beyond Sales/Profit/Daily.

## Files Touched

- `app/(auth)/reports/page.tsx` — nested channel tabs + access control.
- `components/reports/SalesReport.tsx` — `channel` prop, hide internal type filter when set.
- `components/reports/ProfitReport.tsx` — `channel` prop + consignment/agent caption.
- `components/reports/DailySalesSummary.tsx` — `channel` prop.
- `components/reports/CustomerSalesReport.tsx` — universe filter.
- `components/reports/ProductPerformanceReport.tsx` — universe filter.
- `components/reports/PaymentMethodReport.tsx` — universe filter.
- `components/reports/GLTransactionsReport.tsx` — universe filter (plus existing GL filter).
- `lib/constants/index.ts` — `REPORTABLE_SALE_TYPES` constant.
- `supabase/migrations/015_agent_sale_track_product_stock.sql` — RPC fix + backfill.

## Verification

- **Static:** `npm run lint` and `tsc --noEmit` clean.
- **Manual (post-migration):** on `/reports`, each channel tab (Bulk/Consignment/Agent)
  shows Sales/Profit/Daily filtered to that channel; retail never appears; Agent Profit
  shows non-zero cost/margin for backfilled sales; global reports show combined
  Bulk+Consignment+Agent without retail.
- **Migration:** run the pre-check, confirm expected `will_backfill` / `wont_match`
  counts, then apply; spot-check a known agent sale's cost in the Profit report.
