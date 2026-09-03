"use client";

import {
  Payment,
  ReceivePaymentModal,
} from "@/components/payments/ReceivePaymentModal";
import { useAppDispatch } from "@/lib/redux/hook";
import { updateList } from "@/lib/redux/listSlice";
import { supabase } from "@/lib/supabase/client";
import { Consignment } from "@/types";
import toast from "react-hot-toast";

interface Props {
  consignment: Consignment;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const ConsignmentPaymentModal = ({
  consignment,
  isOpen,
  onClose,
  onUpdated,
}: Props) => {
  const dispatch = useAppDispatch();

  // What the customer owes is what was actually sold out of the consignment —
  // items still on their shelf are not payable yet.
  const totalSoldValue = Number(consignment.total_sold_value || 0);

  // The database trigger from migration 022 keeps these two columns derived
  // from the ledger; writing them here keeps the list correct on a deployment
  // where the migration has not been applied yet, and both write the same value.
  const handleSaved = async (totalPaid: number) => {
    const balanceDue = Math.round((totalSoldValue - totalPaid) * 100) / 100;

    const { error } = await supabase
      .from("consignments")
      .update({ total_paid: totalPaid, balance_due: balanceDue })
      .eq("id", consignment.id);

    if (error) {
      toast.error("Payment saved, but the balance could not be updated.");
      return;
    }

    dispatch(
      updateList({
        id: consignment.id,
        total_paid: totalPaid,
        balance_due: balanceDue,
      })
    );
  };

  // PaymentHistoryPrint is written against a transaction, so map the
  // consignment onto the fields it reads.
  const buildPrintData = async (payments: Payment[]) => {
    let customerData = null;
    if (consignment.customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", consignment.customer_id)
        .single();

      if (!customerError && customer) {
        customerData = customer;
      }
    }

    return {
      transaction: {
        ...consignment,
        transaction_number: consignment.consignment_number,
        total_amount: totalSoldValue,
        customer: customerData,
      },
      payments,
    };
  };

  return (
    <ReceivePaymentModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Receive Payment — ${consignment.consignment_number}`}
      ledger={{
        table: "consignment_payments",
        foreignKey: "consignment_id",
        recordId: consignment.id,
        totalAmount: totalSoldValue,
      }}
      onSaved={handleSaved}
      buildPrintData={buildPrintData}
      onUpdated={onUpdated}
    />
  );
};
