/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase/client";

export interface TransactionItem {
  product_id: number;
  quantity: number;
  price: number;
  unit?: string;
}

export interface CreateTransactionParams {
  org_id: number;
  customer_id: number;
  customer_name: string;
  transaction_type: "retail" | "bulk" | "consignment";
  payment_type: string;
  payment_status?: string;
  total_amount: number;
  gl_number?: string;
  billing_agency?: string;
  beneficiary_name?: string;
  branch_id: number;
  items: TransactionItem[];
}

export interface TransactionResult {
  success: boolean;
  transaction_id?: number;
  transaction_number?: string;
  message?: string;
  error?: string;
}

/**
 * Creates a transaction with atomic stock deduction using database function
 * This prevents race conditions when multiple users create transactions simultaneously
 */
export async function createTransactionWithStockDeduction(
  params: CreateTransactionParams
): Promise<TransactionResult> {
  try {
    // 1️⃣ Generate transaction number with branch_id
    const { data: transactionNumber, error: numberError } = await supabase.rpc(
      "generate_transaction_number",
      { p_branch_id: params.branch_id }
    );

    if (numberError) {
      throw new Error(
        `Failed to generate transaction number: ${numberError.message}`
      );
    }

    // 2️⃣ Call the atomic transaction creation function
    const { data, error } = await supabase.rpc(
      "create_transaction_with_stock_deduction",
      {
        p_org_id: params.org_id,
        p_customer_id: params.customer_id,
        p_customer_name: params.customer_name,
        p_transaction_number: transactionNumber,
        p_transaction_type: params.transaction_type,
        p_payment_type: params.payment_type,
        p_payment_status: params.payment_status || "Paid",
        p_total_amount: params.total_amount,
        p_gl_number: params.gl_number || null,
        p_billing_agency: params.billing_agency || null,
        p_beneficiary_name: params.beneficiary_name || null,
        p_branch_id: params.branch_id,
        p_items: params.items,
      }
    );

    if (error) {
      console.error("Database function error:", error);
      return {
        success: false,
        error: error.message,
        message: `Transaction failed: ${error.message}`,
      };
    }

    // Parse the result from the function
    const result = data as TransactionResult;

    return result;
  } catch (err: any) {
    console.error("Transaction creation error:", err);
    return {
      success: false,
      error: err.message,
      message: `Transaction failed: ${err.message}`,
    };
  }
}

/**
 * Validates cart items before transaction
 */
export function validateCartItems(items: TransactionItem[]): {
  valid: boolean;
  error?: string;
} {
  if (!items || items.length === 0) {
    return { valid: false, error: "Cart is empty" };
  }

  for (const item of items) {
    if (!item.product_id || item.product_id <= 0) {
      return { valid: false, error: "Invalid product ID" };
    }
    if (!item.quantity || item.quantity <= 0) {
      return { valid: false, error: "Invalid quantity" };
    }
    if (!item.price || item.price < 0) {
      return { valid: false, error: "Invalid price" };
    }
  }

  return { valid: true };
}
