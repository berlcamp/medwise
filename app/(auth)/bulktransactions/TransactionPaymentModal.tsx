/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Payment,
  ReceivePaymentModal,
} from "@/components/payments/ReceivePaymentModal";
import { useAppDispatch } from "@/lib/redux/hook";
import { updateList } from "@/lib/redux/listSlice";
import { supabase } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface Props {
  transaction: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

// Payment status is derived from the ledger, never set by hand. Mirrors
// medwise.recompute_transaction_payment_status() in migration 021.
const derivePaymentStatus = (totalPaid: number, totalAmount: number) => {
  if (totalPaid <= 0) return "Unpaid";
  if (totalPaid >= totalAmount - 0.005) return "Paid";
  return "Partial";
};

export const TransactionPaymentModal = ({
  transaction,
  isOpen,
  onClose,
  onUpdated,
}: Props) => {
  const dispatch = useAppDispatch();
  const totalAmount = Number(transaction.total_amount || 0);

  // Persist the derived status. The database trigger from migration 021 does
  // this too; writing it here keeps the list correct on a deployment where the
  // migration has not been applied yet, and both write the same value.
  const handleSaved = async (totalPaid: number) => {
    const status = derivePaymentStatus(totalPaid, totalAmount);

    const { error } = await supabase
      .from("transactions")
      .update({ payment_status: status })
      .eq("id", transaction.id);

    if (error) {
      toast.error("Payment saved, but the status could not be updated.");
      return;
    }

    // updateList merges, so send only what changed — spreading the whole
    // transaction would overwrite fresher fields in the list.
    dispatch(updateList({ id: transaction.id, payment_status: status }));
  };

  const buildPrintData = async (payments: Payment[]) => {
    let customerData = null;
    if (transaction.customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", transaction.customer_id)
        .single();

      if (!customerError && customer) {
        customerData = customer;
      }
    }

    return {
      transaction: { ...transaction, customer: customerData },
      payments,
    };
  };

  return (
    <ReceivePaymentModal
      isOpen={isOpen}
      onClose={onClose}
      ledger={{
        table: "transaction_payments",
        foreignKey: "transaction_id",
        recordId: transaction.id,
        totalAmount,
      }}
      onSaved={handleSaved}
      buildPrintData={buildPrintData}
      onUpdated={onUpdated}
    />
  );
};
