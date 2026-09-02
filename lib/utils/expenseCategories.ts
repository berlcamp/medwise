import { supabase } from "@/lib/supabase/client";
import { ExpenseCategory } from "@/types";

export const EXPENSE_CATEGORIES_TABLE = "expense_categories";

/**
 * Loads the org's editable expense categories, alphabetically.
 *
 * Categories live in `medwise.expense_categories` and are referenced from
 * `medwise.expenses.category` by NAME (not by id), so removing a category
 * never orphans historical expenses.
 */
export async function fetchExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase
    .from(EXPENSE_CATEGORIES_TABLE)
    .select("*")
    .eq("org_id", process.env.NEXT_PUBLIC_ORG_ID)
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load expense categories:", error);
    return [];
  }

  return (data || []) as ExpenseCategory[];
}

/** Just the names — what the dropdowns and filters actually need. */
export async function fetchExpenseCategoryNames(): Promise<string[]> {
  const categories = await fetchExpenseCategories();
  return categories.map((c) => c.name);
}
