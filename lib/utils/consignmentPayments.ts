/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase/client";

/**
 * Consignment collections.
 *
 * A consignment_sale transaction is never paid on its own: the customer settles
 * the whole consignment, and those collections land in `consignment_payments`
 * against the consignment (migration 022). The sale rows are inserted with
 * payment_status 'Pending' and nothing updates them, so any report that reads
 * `transactions.payment_status` for this channel must resolve the status off
 * the parent consignment instead — that is what these helpers do.
 */

export type ConsignmentPaymentStatus = "Paid" | "Partial" | "Unpaid";

export interface ConsignmentPaymentSummary {
  id: number;
  branch_id: number | null;
  consignment_number: string;
  customer_name: string | null;
  month: number;
  year: number;
  totalSoldValue: number;
  totalPaid: number;
  balanceDue: number;
  status: ConsignmentPaymentStatus;
}

export interface ConsignmentPaymentRow {
  id: number;
  consignment_id: number;
  amount: number;
  payment_date: string | null;
  payment_method: string | null;
  reference_number: string | null;
  collection_receipt_number: string | null;
  bank_name: string | null;
  cheque_date: string | null;
  billing_agency: string | null;
  beneficiary_name: string | null;
  remarks: string | null;
  created_by: string | null;
}

// Same thresholds the database uses for transactions (migration 021), so a
// consignment reads Paid at the same point a bulk invoice would.
export const deriveConsignmentStatus = (
  totalSoldValue: number,
  totalPaid: number
): ConsignmentPaymentStatus => {
  if (totalPaid <= 0) return "Unpaid";
  if (totalPaid >= totalSoldValue - 0.005) return "Paid";
  return "Partial";
};

export const toConsignmentSummary = (row: any): ConsignmentPaymentSummary => {
  const totalSoldValue = Number(row.total_sold_value) || 0;
  const totalPaid = Number(row.total_paid) || 0;

  return {
    id: row.id,
    branch_id: row.branch_id ?? null,
    consignment_number: row.consignment_number,
    customer_name: row.customer_name ?? null,
    month: Number(row.month) || 0,
    year: Number(row.year) || 0,
    totalSoldValue,
    totalPaid,
    // balance_due is maintained by the database, but a consignment that has
    // never been touched since migration 022 can still be behind; the ledger
    // values are the source of truth.
    balanceDue: Math.round((totalSoldValue - totalPaid) * 100) / 100,
    status: deriveConsignmentStatus(totalSoldValue, totalPaid),
  };
};

const CONSIGNMENT_SUMMARY_COLUMNS =
  "id, branch_id, consignment_number, customer_name, month, year, total_sold_value, total_paid, balance_due, status";

/**
 * Loads the collection state of the given consignments, keyed by consignment id.
 */
export async function fetchConsignmentSummaries(
  consignmentIds: number[]
): Promise<Map<number, ConsignmentPaymentSummary>> {
  const map = new Map<number, ConsignmentPaymentSummary>();
  const ids = Array.from(new Set(consignmentIds.filter(Boolean)));
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("consignments")
    .select(CONSIGNMENT_SUMMARY_COLUMNS)
    .in("id", ids);

  if (error) {
    console.error("Failed to load consignment payment summaries:", error);
    return map;
  }

  (data || []).forEach((row: any) => map.set(row.id, toConsignmentSummary(row)));
  return map;
}

/**
 * Payment status for a sale transaction. Consignment sales report the status of
 * the consignment that owns them; everything else keeps its own column.
 *
 * Sales recorded before migration 023 (and any that could not be matched to a
 * consignment by its backfill) have no `consignment_id` and fall back to the
 * transaction's own status.
 */
export function saleStatusOf(
  transaction: any,
  consignments: Map<number, ConsignmentPaymentSummary>
): string {
  if (transaction?.transaction_type !== "consignment_sale") {
    return transaction?.payment_status || "-";
  }

  const summary = transaction.consignment_id
    ? consignments.get(transaction.consignment_id)
    : undefined;

  return summary ? summary.status : transaction?.payment_status || "-";
}

/**
 * Resolves the consignments behind a set of sale transactions in one query.
 */
export async function fetchConsignmentsForSales(
  transactions: any[]
): Promise<Map<number, ConsignmentPaymentSummary>> {
  const ids = transactions
    .filter((t) => t?.transaction_type === "consignment_sale")
    .map((t) => t.consignment_id)
    .filter((id): id is number => Boolean(id));

  return fetchConsignmentSummaries(ids);
}

/**
 * Collections recorded in a date range, scoped to a branch through the
 * consignment each payment belongs to (the ledger has no branch column).
 *
 * Returns the payments together with the consignments they were paid against.
 */
export async function fetchConsignmentCollections(params: {
  branchId: number;
  start: string; // yyyy-MM-dd
  end: string; // yyyy-MM-dd
}): Promise<{
  payments: ConsignmentPaymentRow[];
  consignments: Map<number, ConsignmentPaymentSummary>;
  error: string | null;
}> {
  const empty = {
    payments: [] as ConsignmentPaymentRow[],
    consignments: new Map<number, ConsignmentPaymentSummary>(),
  };

  const { data, error } = await supabase
    .from("consignment_payments")
    .select(
      "id, consignment_id, amount, payment_date, payment_method, reference_number, collection_receipt_number, bank_name, cheque_date, billing_agency, beneficiary_name, remarks, created_by"
    )
    .gte("payment_date", `${params.start} 00:00:00`)
    .lte("payment_date", `${params.end} 23:59:59`)
    .order("payment_date", { ascending: false });

  if (error) {
    console.error("Failed to load consignment payments:", error);
    return { ...empty, error: error.message };
  }

  const rows = (data || []) as ConsignmentPaymentRow[];
  const consignments = await fetchConsignmentSummaries(
    rows.map((p) => p.consignment_id)
  );

  // The payments table has no branch column, so the consignment each payment
  // belongs to is what scopes it — that also drops payments whose consignment
  // has since been deleted.
  return {
    payments: rows.filter(
      (p) => consignments.get(p.consignment_id)?.branch_id === params.branchId
    ),
    consignments,
    error: null,
  };
}

/**
 * Consignments a payments report should list for a period: everything opened in
 * the range, plus anything collected against in the range (an older consignment
 * settled this month still belongs in the report).
 */
export async function fetchConsignmentsForPeriod(params: {
  branchId: number;
  start: string; // yyyy-MM-dd
  end: string; // yyyy-MM-dd
  extraIds?: number[];
}): Promise<ConsignmentPaymentSummary[]> {
  const { data, error } = await supabase
    .from("consignments")
    .select(CONSIGNMENT_SUMMARY_COLUMNS)
    .eq("branch_id", params.branchId)
    .gte("created_at", `${params.start} 00:00:00`)
    .lte("created_at", `${params.end} 23:59:59`);

  if (error) {
    console.error("Failed to load consignments for period:", error);
    return [];
  }

  const byId = new Map<number, ConsignmentPaymentSummary>();
  (data || []).forEach((row: any) => byId.set(row.id, toConsignmentSummary(row)));

  const missing = (params.extraIds || []).filter((id) => !byId.has(id));
  if (missing.length > 0) {
    const extras = await fetchConsignmentSummaries(missing);
    extras.forEach((summary, id) => byId.set(id, summary));
  }

  return Array.from(byId.values()).sort((a, b) =>
    b.consignment_number.localeCompare(a.consignment_number)
  );
}
