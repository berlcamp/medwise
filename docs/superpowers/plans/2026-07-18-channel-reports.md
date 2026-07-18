# Channel-Grouped Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `/reports` into channel tabs (Bulk / Consignment / Agent, each with Sales · Profit · Daily), exclude retail from all reports, and fix agent-sale cost tracking so Agent Profit is accurate.

**Architecture:** A single shared constant defines the reportable sale types and the channel→transaction_type mapping. `SalesReport`, `ProfitReport`, and `DailySalesSummary` gain an optional `channel` prop that scopes their query; global reports filter to the reportable set. A new `ChannelReports` component renders the inner Sales/Profit/Daily tabs. A migration fixes `record_agent_sale` and backfills historical `product_stock_id`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Supabase (`medwise` schema), Shadcn `Tabs`, Tailwind.

## Global Constraints

- No test framework is configured. Per-task verification = `npm run lint` and `npx tsc --noEmit` clean, plus manual observation where noted. Do NOT introduce a test runner.
- All Supabase clients use the `medwise` schema; RPCs/tables are prefixed `medwise.` in SQL.
- Migrations are sequential in `supabase/migrations/`; the next number is `015`.
- Path alias `@/` maps to project root.
- Reportable sale types (verbatim): `["bulk", "consignment_sale", "agent_sale"]`. Retail (`retail`) and consignment hand-offs (`consignment_add`) are always excluded from sales reports.
- Channel → transaction_type: `bulk → "bulk"`, `consignment → "consignment_sale"`, `agent → "agent_sale"`.
- Access control: bulk users see only Inventory/Expiry/Stock; the Profit sub-tab is admin-only (`admin`/`super admin`); cashiers have no `/reports` access.

---

### Task 1: Shared reporting constants

**Files:**
- Modify: `lib/constants/index.ts` (append at end)

**Interfaces:**
- Produces:
  - `export type ReportChannel = "bulk" | "consignment" | "agent"`
  - `export const REPORTABLE_SALE_TYPES: string[]`
  - `export const CHANNEL_TX_TYPE: Record<ReportChannel, string>`

- [ ] **Step 1: Append the constants**

Add to the end of `lib/constants/index.ts`:

```ts
// ===============================
// REPORTS — sales channel scoping
// ===============================
export type ReportChannel = "bulk" | "consignment" | "agent";

// Transaction types counted by sales/profit reports. Excludes retail and
// consignment hand-offs (consignment_add). Agent hand-offs create no
// transaction row, so nothing to exclude there.
export const REPORTABLE_SALE_TYPES: string[] = [
  "bulk",
  "consignment_sale",
  "agent_sale",
];

// One channel tab → its transaction_type.
export const CHANNEL_TX_TYPE: Record<ReportChannel, string> = {
  bulk: "bulk",
  consignment: "consignment_sale",
  agent: "agent_sale",
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/constants/index.ts
git commit -m "feat(reports): add reportable sale types + channel mapping constants"
```

---

### Task 2: Migration 015 — agent-sale cost tracking

**Files:**
- Create: `supabase/migrations/015_agent_sale_track_product_stock.sql`

**Interfaces:**
- Produces: `record_agent_sale` that writes `product_stock_id`; historical `agent_sale` transaction_items backfilled.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/015_agent_sale_track_product_stock.sql` with:

```sql
-- =====================================================
-- AGENT SALE COST TRACKING
-- =====================================================
-- 1. record_agent_sale now stores product_stock_id on each transaction_item
--    so the Profit report can resolve batch purchase cost.
-- 2. One-time backfill of product_stock_id for existing agent_sale lines,
--    matched via batch_no -> product_stocks. This field is read ONLY by the
--    Profit report cost lookup; it drives no stock/return/void/money logic,
--    so the backfill cannot affect inventory or financial records.
--
-- PRE-CHECK (run manually BEFORE applying; not executed by this migration):
--   SELECT
--     count(*) FILTER (WHERE ps.id IS NOT NULL) AS will_backfill,
--     count(*) FILTER (WHERE ps.id IS NULL)     AS wont_match,
--     count(*) FILTER (WHERE ti.batch_no IS NULL) AS no_batch_no
--   FROM medwise.transaction_items ti
--   JOIN medwise.transactions t ON t.id = ti.transaction_id
--   LEFT JOIN LATERAL (
--     SELECT ps.id FROM medwise.product_stocks ps
--     WHERE ps.product_id = ti.product_id
--       AND ps.batch_no  = ti.batch_no
--       AND ps.branch_id = t.branch_id
--     ORDER BY ps.id LIMIT 1
--   ) ps ON true
--   WHERE t.transaction_type = 'agent_sale'
--     AND ti.product_stock_id IS NULL;

-- 1️⃣ Redefine record_agent_sale (adds product_stock_id to the item INSERT)
CREATE OR REPLACE FUNCTION medwise.record_agent_sale(
  p_agent_id BIGINT,
  p_customer_id INTEGER,
  p_customer_name TEXT,
  p_items JSONB, -- [{product_id, quantity, price}]
  p_transaction_number TEXT,
  p_payment_type TEXT,
  p_payment_status TEXT,
  p_created_by TEXT
) RETURNS JSON AS $$
DECLARE
  v_agent RECORD;
  v_item JSONB;
  v_agent_item RECORD;
  v_transaction_id BIGINT;
  v_total_amount DECIMAL(10,2) := 0;
  v_quantity INTEGER;
  v_price DECIMAL(10,2);
  v_product_id INTEGER;
BEGIN
  SELECT * INTO v_agent
  FROM medwise.agents
  WHERE id = p_agent_id
  FOR UPDATE;

  IF v_agent.id IS NULL THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::DECIMAL(10,2);
    v_total_amount := v_total_amount + (v_quantity * v_price);
  END LOOP;

  INSERT INTO medwise.transactions (
    org_id, branch_id, customer_id, customer_name, transaction_number,
    transaction_type, payment_type, payment_status, total_amount, status
  ) VALUES (
    v_agent.org_id, v_agent.branch_id, p_customer_id, p_customer_name,
    p_transaction_number, 'agent_sale', p_payment_type, p_payment_status,
    v_total_amount, 'completed'
  ) RETURNING id INTO v_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::DECIMAL(10,2);

    SELECT * INTO v_agent_item
    FROM medwise.agent_items
    WHERE agent_id = p_agent_id
      AND product_id = v_product_id
      AND current_balance > 0
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_agent_item.id IS NULL THEN
      RAISE EXCEPTION 'No available stock for product ID %', v_product_id;
    END IF;

    -- product_stock_id added here so cost can be resolved later
    INSERT INTO medwise.transaction_items (
      transaction_id, product_id, product_stock_id, quantity, price, total,
      batch_no, expiration_date
    ) VALUES (
      v_transaction_id, v_product_id, v_agent_item.product_stock_id,
      v_quantity, v_price, v_quantity * v_price,
      v_agent_item.batch_no, v_agent_item.expiration_date
    );

    UPDATE medwise.agent_items
    SET quantity_sold = quantity_sold + v_quantity,
        current_balance = current_balance - v_quantity,
        transaction_id = v_transaction_id,
        updated_at = NOW()
    WHERE id = v_agent_item.id;
  END LOOP;

  INSERT INTO medwise.agent_history (
    agent_id, action_type, amount, notes, created_by
  ) VALUES (
    p_agent_id, 'sale_recorded', v_total_amount,
    'Sale recorded - Transaction: ' || p_transaction_number, p_created_by
  );

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'transaction_number', p_transaction_number,
    'message', 'Sale recorded successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to record sale: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION medwise.record_agent_sale TO authenticated;

-- 2️⃣ One-time backfill for historical agent_sale lines (null-only, reversible)
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

- [ ] **Step 2: Review the SQL against the current function**

Confirm the only difference from `009_update_record_agent_sale_customer.sql` is the added `product_stock_id` column + `v_agent_item.product_stock_id` value in the transaction_items INSERT. Everything else is byte-for-byte behavior-preserving.

- [ ] **Step 3: Apply in Supabase (manual, gated)**

Take a Supabase snapshot first. Run the PRE-CHECK query from the file header; note `will_backfill` / `wont_match` / `no_batch_no`. If the counts look sane, run the migration file in the Supabase SQL editor.

Expected: function replaced; backfill updates `will_backfill` rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/015_agent_sale_track_product_stock.sql
git commit -m "feat(agents): track product_stock_id on agent sales + backfill"
```

---

### Task 3: `SalesReport` channel prop

**Files:**
- Modify: `components/reports/SalesReport.tsx`

**Interfaces:**
- Consumes: `ReportChannel`, `REPORTABLE_SALE_TYPES`, `CHANNEL_TX_TYPE` from `@/lib/constants` (Task 1).
- Produces: `export default function SalesReport({ channel }: { channel?: ReportChannel })`.

- [ ] **Step 1: Import the constants**

Add near the top imports of `components/reports/SalesReport.tsx`:

```ts
import {
  REPORTABLE_SALE_TYPES,
  CHANNEL_TX_TYPE,
  type ReportChannel,
} from "@/lib/constants";
```

- [ ] **Step 2: Add the prop to the signature**

Change (line ~35):

```ts
export default function SalesReport() {
```
to:
```ts
export default function SalesReport({
  channel,
}: {
  channel?: ReportChannel;
} = {}) {
```

- [ ] **Step 3: Replace the transaction_type filtering in the query**

Change the query chain (lines ~116-118) from:

```ts
      .eq("branch_id", selectedBranchId)
      // Exclude consignment hand-off transactions (goods on loan, not sales)
      .neq("transaction_type", "consignment_add")
      .gte("created_at", `${start} 00:00:00`)
```
to:
```ts
      .eq("branch_id", selectedBranchId)
      .gte("created_at", `${start} 00:00:00`)
```

Then change the type-filter block (lines ~122-125) from:

```ts
    // 🔥 Apply transaction type filter
    if (txnType !== "All") {
      query = query.eq("transaction_type", txnType);
    }
```
to:
```ts
    // Channel scoping. Inside a channel tab the type is fixed; otherwise limit
    // to reportable sale types (retail + consignment hand-offs excluded).
    if (channel) {
      query = query.eq("transaction_type", CHANNEL_TX_TYPE[channel]);
    } else {
      query = query.in("transaction_type", REPORTABLE_SALE_TYPES);
      // Manual type dropdown only applies to the standalone (no-channel) view.
      if (txnType !== "All") {
        query = query.eq("transaction_type", txnType);
      }
    }
```

- [ ] **Step 4: Hide the Transaction Type dropdown when channel-scoped**

Wrap the "Transaction Type" filter block (lines ~252-273, the `<div>` starting with `{/* Transaction Type */}`) so it only renders when `!channel`. Change:

```tsx
            {/* Transaction Type */}
            <div className="space-y-1.5">
```
to:
```tsx
            {/* Transaction Type (standalone view only) */}
            {!channel && (
            <div className="space-y-1.5">
```

and add the closing `)}` immediately after that div's closing `</div>` (the one right before `{/* Payment Status */}`):

```tsx
              </Select>
            </div>
            )}

            {/* Payment Status */}
```

- [ ] **Step 5: Add `channel` to the effect deps**

Change (line ~213):

```ts
  }, [txnType, paymentStatus, selectedBranchId]);
```
to:
```ts
  }, [txnType, paymentStatus, selectedBranchId, channel]);
```

- [ ] **Step 6: Lint + typecheck**

Run: `npx next lint --file components/reports/SalesReport.tsx && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/reports/SalesReport.tsx
git commit -m "feat(reports): channel-scope SalesReport"
```

---

### Task 4: `DailySalesSummary` channel prop

**Files:**
- Modify: `components/reports/DailySalesSummary.tsx`

**Interfaces:**
- Consumes: `ReportChannel`, `REPORTABLE_SALE_TYPES`, `CHANNEL_TX_TYPE`.
- Produces: `export const DailySalesSummary = ({ channel }: { channel?: ReportChannel }) => ...`.

- [ ] **Step 1: Import constants**

Add to imports:

```ts
import {
  REPORTABLE_SALE_TYPES,
  CHANNEL_TX_TYPE,
  type ReportChannel,
} from "@/lib/constants";
```

- [ ] **Step 2: Add the prop**

Change (line ~37):

```ts
export const DailySalesSummary = () => {
```
to:
```ts
export const DailySalesSummary = ({
  channel,
}: {
  channel?: ReportChannel;
} = {}) => {
```

- [ ] **Step 3: Replace the type filter in the query**

Change (line ~105):

```ts
        .neq("transaction_type", "consignment_add")
```
to:
```ts
        .in(
          "transaction_type",
          channel ? [CHANNEL_TX_TYPE[channel]] : REPORTABLE_SALE_TYPES
        )
```

- [ ] **Step 4: Add `channel` to effect deps**

Change (line ~186):

```ts
  }, [startDate, endDate, selectedBranchId]);
```
to:
```ts
  }, [startDate, endDate, selectedBranchId, channel]);
```

- [ ] **Step 5: Lint + typecheck**

Run: `npx next lint --file components/reports/DailySalesSummary.tsx && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/reports/DailySalesSummary.tsx
git commit -m "feat(reports): channel-scope DailySalesSummary"
```

---

### Task 5: `ProfitReport` channel prop + caption

**Files:**
- Modify: `components/reports/ProfitReport.tsx`

**Interfaces:**
- Consumes: `ReportChannel`, `REPORTABLE_SALE_TYPES`, `CHANNEL_TX_TYPE`.
- Produces: `export const ProfitReport = ({ channel }: { channel?: ReportChannel }) => ...`.

- [ ] **Step 1: Import constants**

Add to imports:

```ts
import {
  REPORTABLE_SALE_TYPES,
  CHANNEL_TX_TYPE,
  type ReportChannel,
} from "@/lib/constants";
```

- [ ] **Step 2: Add the prop**

Change:

```ts
export const ProfitReport = () => {
```
to:
```ts
export const ProfitReport = ({
  channel,
}: {
  channel?: ReportChannel;
} = {}) => {
```

- [ ] **Step 3: Scope the accrual query**

In `fetchData`, change the accrual query filter:

```ts
      .neq("transaction_type", "consignment_add")
```
to:
```ts
      .in(
        "transaction_type",
        channel ? [CHANNEL_TX_TYPE[channel]] : REPORTABLE_SALE_TYPES
      )
```

- [ ] **Step 4: Scope the collected query**

In `fetchCollected`, the parent-transaction query has:

```ts
        .eq("branch_id", selectedBranchId)
        .neq("transaction_type", "consignment_add");
```
Change to:
```ts
        .eq("branch_id", selectedBranchId)
        .in(
          "transaction_type",
          channel ? [CHANNEL_TX_TYPE[channel]] : REPORTABLE_SALE_TYPES
        );
```

- [ ] **Step 5: Caption when Payments Received is empty for non-bulk**

In the Profit Report table `CardHeader`, the collected caption currently reads
`{basis === "collected" && (...)}`. Extend it to warn for consignment/agent.
Replace that caption block with:

```tsx
          {basis === "collected" && (
            <p className="text-sm text-gray-500">
              Based on payments received (by payment date). Cost and profit are
              estimated per payment in proportion to each transaction&apos;s
              margin.
              {channel && channel !== "bulk" && (
                <>
                  {" "}
                  Note: {channel} sales don&apos;t record payments here, so this
                  view will be empty for this channel.
                </>
              )}
            </p>
          )}
```

- [ ] **Step 6: Add `channel` to effect deps**

Change:

```ts
  }, [isAdmin, selectedBranchId, mode, range, basis]);
```
to:
```ts
  }, [isAdmin, selectedBranchId, mode, range, basis, channel]);
```

- [ ] **Step 7: Lint + typecheck**

Run: `npx next lint --file components/reports/ProfitReport.tsx && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/reports/ProfitReport.tsx
git commit -m "feat(reports): channel-scope ProfitReport + non-bulk caption"
```

---

### Task 6: Global reports — reportable-set filter

**Files:**
- Modify: `components/reports/CustomerSalesReport.tsx`
- Modify: `components/reports/ProductPerformanceReport.tsx`
- Modify: `components/reports/PaymentMethodReport.tsx`
- Modify: `components/reports/GLTransactionsReport.tsx`

**Interfaces:**
- Consumes: `REPORTABLE_SALE_TYPES`.

- [ ] **Step 1: CustomerSalesReport**

Add import: `import { REPORTABLE_SALE_TYPES } from "@/lib/constants";`
Change (line ~61):

```ts
        .neq("transaction_type", "consignment_add")
```
to:
```ts
        .in("transaction_type", REPORTABLE_SALE_TYPES)
```

- [ ] **Step 2: ProductPerformanceReport**

Add import: `import { REPORTABLE_SALE_TYPES } from "@/lib/constants";`
Change (line ~70):

```ts
        .neq("transaction_type", "consignment_add")
```
to:
```ts
        .in("transaction_type", REPORTABLE_SALE_TYPES)
```

- [ ] **Step 3: PaymentMethodReport**

Add import: `import { REPORTABLE_SALE_TYPES } from "@/lib/constants";`
Change (line ~85):

```ts
        .neq("transaction_type", "consignment_add")
```
to:
```ts
        .in("transaction_type", REPORTABLE_SALE_TYPES)
```

- [ ] **Step 4: GLTransactionsReport**

Add import: `import { REPORTABLE_SALE_TYPES } from "@/lib/constants";`
Change the query (line ~114) from:

```ts
      .eq("payment_type", "GL")
```
to:
```ts
      .eq("payment_type", "GL")
      .in("transaction_type", REPORTABLE_SALE_TYPES)
```

- [ ] **Step 5: Lint + typecheck**

Run: `npx next lint --file components/reports/CustomerSalesReport.tsx --file components/reports/ProductPerformanceReport.tsx --file components/reports/PaymentMethodReport.tsx --file components/reports/GLTransactionsReport.tsx && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/reports/CustomerSalesReport.tsx components/reports/ProductPerformanceReport.tsx components/reports/PaymentMethodReport.tsx components/reports/GLTransactionsReport.tsx
git commit -m "feat(reports): scope global reports to reportable sale types"
```

---

### Task 7: `ChannelReports` inner-tab component

**Files:**
- Create: `components/reports/ChannelReports.tsx`

**Interfaces:**
- Consumes: `ReportChannel`; `SalesReport` (default), `ProfitReport`, `DailySalesSummary` (all now accept `channel`).
- Produces: `export function ChannelReports({ channel, isAdmin }: { channel: ReportChannel; isAdmin: boolean })`.

- [ ] **Step 1: Create the component**

Create `components/reports/ChannelReports.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesReport from "@/components/reports/SalesReport";
import { ProfitReport } from "@/components/reports/ProfitReport";
import { DailySalesSummary } from "@/components/reports/DailySalesSummary";
import type { ReportChannel } from "@/lib/constants";

export function ChannelReports({
  channel,
  isAdmin,
}: {
  channel: ReportChannel;
  isAdmin: boolean;
}) {
  const [sub, setSub] = useState("sales");

  return (
    <Tabs value={sub} onValueChange={setSub} className="w-full">
      <TabsList className="inline-flex gap-2 h-auto p-1 bg-gray-100">
        <TabsTrigger value="sales" className="px-4 py-2">
          Sales
        </TabsTrigger>
        {isAdmin && (
          <TabsTrigger value="profit" className="px-4 py-2">
            Profit
          </TabsTrigger>
        )}
        <TabsTrigger value="daily" className="px-4 py-2">
          Daily
        </TabsTrigger>
      </TabsList>

      <div className="mt-4">
        <TabsContent value="sales" className="mt-0">
          <SalesReport channel={channel} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="profit" className="mt-0">
            <ProfitReport channel={channel} />
          </TabsContent>
        )}
        <TabsContent value="daily" className="mt-0">
          <DailySalesSummary channel={channel} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `npx next lint --file components/reports/ChannelReports.tsx && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/reports/ChannelReports.tsx
git commit -m "feat(reports): add ChannelReports inner-tab component"
```

---

### Task 8: Restructure the reports page

**Files:**
- Modify: `app/(auth)/reports/page.tsx` (full replacement)

**Interfaces:**
- Consumes: `ChannelReports` (Task 7); global report components (unchanged imports minus `SalesReport`/`DailySalesSummary`/`ProfitReport`, which now render inside `ChannelReports`).

- [ ] **Step 1: Replace the file contents**

Replace `app/(auth)/reports/page.tsx` entirely with:

```tsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import Notfoundpage from "@/components/Notfoundpage";
import { ChannelReports } from "@/components/reports/ChannelReports";
import { CustomerSalesReport } from "@/components/reports/CustomerSalesReport";
import { ExpiryReport } from "@/components/reports/ExpiryReport";
import GLTransactionsReport from "@/components/reports/GLTransactionsReport";
import InventoryReport from "@/components/reports/InventoryReport";
import { PaymentMethodReport } from "@/components/reports/PaymentMethodReport";
import { ProductPerformanceReport } from "@/components/reports/ProductPerformanceReport";
import { StockCardReport } from "@/components/reports/StockCardReport";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppSelector } from "@/lib/redux/hook";
import {
  BarChart3,
  Calendar,
  CreditCard,
  FileText,
  Package,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function ReportsPage() {
  const user = useAppSelector((state) => state.user.user);
  const isBulkUser = user?.type === "bulk";
  const isAdmin = user?.type === "admin" || user?.type === "super admin";

  // Channel tabs (Sales/Profit/Daily inside) — hidden for bulk users.
  const channelTabs = [
    { value: "bulk", label: "Bulk", icon: ShoppingCart },
    { value: "consignment", label: "Consignment", icon: Truck },
    { value: "agent", label: "Agent", icon: UserCog },
  ];

  // Global tabs. Customer/Product/Payment/GL are sales-analysis (hidden for
  // bulk users); Inventory/Expiry/Stock are always available.
  const salesGlobalTabs = [
    { value: "customer", label: "Customer Sales", icon: Users },
    { value: "product", label: "Product Performance", icon: BarChart3 },
    { value: "payment", label: "Payment Methods", icon: CreditCard },
    { value: "gl", label: "GL Transactions", icon: CreditCard },
  ];
  const inventoryTabs = [
    { value: "inventory", label: "Inventory", icon: Package },
    { value: "expiry", label: "Expiry Report", icon: Calendar },
    { value: "stockcard", label: "Stock Movements", icon: FileText },
  ];

  const visibleTabs = [
    ...(isBulkUser ? [] : channelTabs),
    ...(isBulkUser ? [] : salesGlobalTabs),
    ...inventoryTabs,
  ];

  const defaultTab = isBulkUser ? "inventory" : "bulk";
  const [tab, setTab] = useState(defaultTab);

  // Reset to a permitted tab if the current one becomes unavailable.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === tab)) {
      setTab(defaultTab);
    }
  }, [isBulkUser, isAdmin, tab, defaultTab]);

  // Restrict access for cashier users (after all hooks)
  if (user?.type === "cashier") return <Notfoundpage />;

  return (
    <div className="space-y-6">
      <div className="app__title">
        <h1 className="text-3xl font-semibold">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Comprehensive business insights and data analysis
        </p>
      </div>

      <div className="app__content">
        <Card>
          <CardContent className="p-6">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 gap-2 h-auto p-1 bg-gray-100">
                {visibleTabs.map((report) => {
                  const Icon = report.icon;
                  return (
                    <TabsTrigger
                      key={report.value}
                      value={report.value}
                      className="flex flex-col items-center gap-1.5 py-3 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        {report.label}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <div className="mt-6">
                {!isBulkUser && (
                  <>
                    <TabsContent value="bulk" className="mt-0">
                      <ChannelReports channel="bulk" isAdmin={isAdmin} />
                    </TabsContent>
                    <TabsContent value="consignment" className="mt-0">
                      <ChannelReports channel="consignment" isAdmin={isAdmin} />
                    </TabsContent>
                    <TabsContent value="agent" className="mt-0">
                      <ChannelReports channel="agent" isAdmin={isAdmin} />
                    </TabsContent>
                    <TabsContent value="customer" className="mt-0">
                      <CustomerSalesReport />
                    </TabsContent>
                    <TabsContent value="product" className="mt-0">
                      <ProductPerformanceReport />
                    </TabsContent>
                    <TabsContent value="payment" className="mt-0">
                      <PaymentMethodReport />
                    </TabsContent>
                    <TabsContent value="gl" className="mt-0">
                      <GLTransactionsReport />
                    </TabsContent>
                  </>
                )}
                <TabsContent value="inventory" className="mt-0">
                  <InventoryReport />
                </TabsContent>
                <TabsContent value="expiry" className="mt-0">
                  <ExpiryReport />
                </TabsContent>
                <TabsContent value="stockcard" className="mt-0">
                  <StockCardReport />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `npx next lint --file "app/(auth)/reports/page.tsx" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/reports/page.tsx"
git commit -m "feat(reports): nested channel tabs (bulk/consignment/agent)"
```

---

### Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Project-wide static checks**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual smoke test** (`npm run dev`, open `/reports` as an admin with a branch selected)

Verify:
- Top tabs show Bulk / Consignment / Agent + Customer / Product / Payment / GL + Inventory / Expiry / Stock.
- Each channel tab shows inner Sales · Profit · Daily; a non-admin sees no Profit sub-tab.
- Bulk tab shows only `bulk` transactions; Consignment shows only `consignment_sale`; Agent shows only `agent_sale`. No retail rows anywhere.
- Agent → Profit → All Sales: cost/margin are non-zero for backfilled sales.
- Consignment/Agent → Profit → Payments Received: empty, with the caption explaining why.
- Global Customer/Product/Payment show combined Bulk+Consignment+Agent, no retail.
- As a bulk user: only Inventory/Expiry/Stock are visible.

- [ ] **Step 4: Commit any fixes, then done**

```bash
git add -A
git commit -m "chore(reports): verification fixes for channel reports"
```

---

## Self-Review

**Spec coverage:**
- Exclude retail → Tasks 3–6 (`REPORTABLE_SALE_TYPES` / channel filters). ✓
- Nested Bulk/Consignment/Agent tabs with Sales·Profit·Daily → Tasks 7–8. ✓
- Global reports scoped to reportable set → Task 6. ✓
- Channel-aware components → Tasks 3–5. ✓
- Agent cost fix RPC + backfill + pre-check → Task 2. ✓
- Consignment/Agent Payments-Received caption → Task 5, Step 5. ✓
- Access control (bulk-only inventory, admin-only Profit, cashier blocked) → Tasks 7–8. ✓
- Constant in one place → Task 1. ✓

**Placeholder scan:** No TBD/TODO; all code steps show full code. ✓

**Type consistency:** `ReportChannel`, `REPORTABLE_SALE_TYPES`, `CHANNEL_TX_TYPE` defined in Task 1 and consumed identically in Tasks 3–7. `ChannelReports` prop shape matches its usage in Task 8. `SalesReport` default export with optional `channel`; `ProfitReport`/`DailySalesSummary` named exports with optional `channel`. ✓
