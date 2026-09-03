/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ConfirmationModal } from "@/components/ConfirmationModal";
import { PaymentHistoryPrint } from "@/components/printables/PaymentHistoryPrint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { billingAgencies } from "@/lib/constants";
import { supabase } from "@/lib/supabase/client";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { format } from "date-fns";
import { Printer, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

// Which ledger this modal reads and writes. Bulk transactions collect into
// `transaction_payments`; consignments into `consignment_payments`.
export interface PaymentLedger {
  table: string;
  foreignKey: string;
  recordId: number;
  // What is owed in full — the balance is this minus everything recorded.
  totalAmount: number;
}

interface Props {
  ledger: PaymentLedger;
  isOpen: boolean;
  onClose: () => void;
  // Called after every save/remove with the fresh total, so the caller can
  // persist whatever it derives from it (a status, a rollup) and update Redux.
  onSaved?: (totalPaid: number) => Promise<void> | void;
  // Builds the payload for the printable payment history.
  buildPrintData?: (payments: Payment[]) => Promise<any>;
  onUpdated?: () => void;
  title?: string;
}

export type Payment = {
  id: number;
  amount: number | string;
  payment_method: string | null;
  payment_date: string | null;
  reference_number: string | null;
  collection_receipt_number: string | null;
  remarks: string | null;
  bank_name: string | null;
  cheque_date: string | null;
  billing_agency: string | null;
  beneficiary_name: string | null;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const todayString = () => format(new Date(), "yyyy-MM-dd");

// The collection reports bucket payments by payment_date, so a date needs a
// time on it. Today keeps the real clock time (what the column defaulted to
// before); a backdated entry is stamped at noon, which cannot slip into an
// adjacent day when the value is rendered in another timezone.
const paymentTimestamp = (date: string) =>
  date === todayString() ? new Date().toISOString() : `${date}T12:00:00`;

// Transaction cheque/GL details used to be JSON-encoded into `remarks`.
// Migration 021 moved them to real columns, but keep reading the old shape so
// history recorded before that migration still renders.
const legacyDetails = (payment: Payment): any => {
  if (!payment.remarks) return null;
  try {
    const parsed = JSON.parse(payment.remarks);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const ReceivePaymentModal = ({
  ledger,
  isOpen,
  onClose,
  onSaved,
  buildPrintData,
  onUpdated,
  title = "Receive Payment",
}: Props) => {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayString);
  const [method, setMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [collectionReceiptNumber, setCollectionReceiptNumber] = useState("");
  const [loading, setLoading] = useState(false);

  // Cheque-specific fields
  const [chequeNumber, setChequeNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [chequeDate, setChequeDate] = useState("");

  // GL-specific fields
  const [glNumber, setGlNumber] = useState("");
  const [billingAgency, setBillingAgency] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [printData, setPrintData] = useState<any>(null);
  const [paymentToRemove, setPaymentToRemove] = useState<Payment | null>(null);

  // Guards a double-click: `loading` only disables the button on the next
  // render, so two clicks in the same frame would both reach the insert.
  const savingRef = useRef(false);

  const { table, foreignKey, recordId } = ledger;
  const totalAmount = Number(ledger.totalAmount || 0);
  const balance = round2(totalAmount - totalPaid);

  const resetForm = useCallback(() => {
    setAmount("");
    setPaymentDate(todayString());
    setMethod("Cash");
    setReference("");
    setRemarks("");
    setCollectionReceiptNumber("");
    setChequeNumber("");
    setBankName("");
    setChequeDate("");
    setGlNumber("");
    setBillingAgency("");
    setBeneficiaryName("");
  }, []);

  // Load payments. Returns the total paid so callers can act on a fresh number
  // instead of waiting for state to settle.
  const loadPayments = useCallback(async () => {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq(foreignKey, recordId)
      .order("payment_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      toast.error("Failed to load payments.");
      return null;
    }

    const rows = (data || []) as Payment[];
    const paid = round2(rows.reduce((sum, p) => sum + Number(p.amount || 0), 0));

    setPayments(rows);
    setTotalPaid(paid);

    return paid;
  }, [table, foreignKey, recordId]);

  // Reload whenever the modal opens, and whenever it is reused for a different
  // record, so nothing is carried over from the previous one.
  useEffect(() => {
    if (!isOpen) return;
    resetForm();
    setPayments([]);
    setTotalPaid(0);
    loadPayments();
  }, [isOpen, recordId, loadPayments, resetForm]);

  const savePayment = async () => {
    if (savingRef.current) return;

    const amountValue = Number(amount);
    if (!amount || Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error("Invalid amount");
      return;
    }

    if (!paymentDate) {
      toast.error("Please select the payment date");
      return;
    }

    if (paymentDate > todayString()) {
      toast.error("Payment date cannot be in the future");
      return;
    }

    // Validate cheque fields if method is Cheque
    if (method === "Cheque") {
      if (!chequeNumber.trim()) {
        toast.error("Please enter check number");
        return;
      }
      if (!bankName.trim()) {
        toast.error("Please enter bank name");
        return;
      }
      if (!chequeDate) {
        toast.error("Please select check date");
        return;
      }
    }

    // Validate GL fields if method is GL
    if (method === "GL") {
      if (!glNumber.trim()) {
        toast.error("GL Number is required");
        return;
      }
      if (!billingAgency.trim()) {
        toast.error("Billing Agency is required");
        return;
      }
    }

    savingRef.current = true;
    setLoading(true);

    // Re-read the ledger so the balance check uses what is in the database
    // right now, not what was on screen when the modal was opened.
    const { data: current, error: currentError } = await supabase
      .from(table)
      .select("amount")
      .eq(foreignKey, recordId);

    if (currentError) {
      savingRef.current = false;
      setLoading(false);
      toast.error("Could not verify the remaining balance. Please try again.");
      return;
    }

    const paidNow = (current || []).reduce(
      (sum, p: any) => sum + Number(p.amount || 0),
      0
    );
    const balanceCents = Math.round((totalAmount - paidNow) * 100);
    if (Math.round(amountValue * 100) > balanceCents) {
      savingRef.current = false;
      setLoading(false);
      setTotalPaid(round2(paidNow));
      toast.error("Payment cannot exceed remaining balance.");
      return;
    }

    const isCheque = method === "Cheque";
    const isGL = method === "GL";

    const paymentData: Record<string, any> = {
      [foreignKey]: recordId,
      amount: amountValue,
      // Sent explicitly so a payment received on an earlier date is reported in
      // the period it was actually collected.
      payment_date: paymentTimestamp(paymentDate),
      payment_method: method,
      reference_number: isCheque
        ? chequeNumber.trim()
        : isGL
          ? glNumber.trim()
          : reference.trim() || null,
      collection_receipt_number: collectionReceiptNumber.trim() || null,
      // Cheque/GL details go to their own columns, so remarks stay the user's.
      bank_name: isCheque ? bankName.trim() : null,
      cheque_date: isCheque ? chequeDate : null,
      billing_agency: isGL ? billingAgency.trim() : null,
      beneficiary_name: isGL ? beneficiaryName.trim() || null : null,
      remarks: remarks.trim() || null,
    };

    const { error } = await supabase.from(table).insert(paymentData);

    if (error) {
      savingRef.current = false;
      setLoading(false);
      // Surfaces the database balance guard, which is the authority when two
      // users record a payment at the same time.
      toast.error(error.message || "Error saving payment.");
      return;
    }

    const paid = await loadPayments();
    if (paid !== null && onSaved) await onSaved(paid);

    resetForm();
    savingRef.current = false;
    setLoading(false);
    toast.success("Payment recorded");

    if (onUpdated) onUpdated();
  };

  const removePayment = async (payment: Payment) => {
    const { error } = await supabase.from(table).delete().eq("id", payment.id);

    if (error) {
      toast.error("Failed to remove payment.");
      return;
    }

    const paid = await loadPayments();
    if (paid !== null && onSaved) await onSaved(paid);

    toast.success("Payment removed");

    if (onUpdated) onUpdated();
  };

  const printPaymentHistory = async () => {
    if (!buildPrintData) return;

    // Clear print data first
    setPrintData(null);

    // Set print data after clearing
    setPrintData(await buildPrintData(payments));

    // Wait for React to render the component
    setTimeout(() => {
      window.print();
      // Reset after print
      setTimeout(() => {
        setPrintData(null);
      }, 500);
    }, 300);
  };

  const hasChequePayment = payments.some(
    (p) => p.payment_method === "Cheque"
  );
  const hasGLPayment = payments.some((p) => p.payment_method === "GL");
  // Date, Method, Amount, Ref #, Collection Receipt #, Remarks, Action
  const totalCols =
    7 + (hasChequePayment ? 3 : 0) + (hasGLPayment ? 3 : 0);

  return (
    <Dialog open={isOpen} onClose={onClose} as="div" className="relative z-50">
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-gray-600 opacity-80"
        aria-hidden="true"
      />

      {/* Centered panel container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel className="app__modal_dialog_panel_lg !max-w-[min(80rem,calc(100vw-2rem))] w-[calc(100vw-2rem)]">
          {/* Header */}
          <div className="app__modal_dialog_title_container">
            <DialogTitle className="text-base font-medium">
              {title}
            </DialogTitle>
          </div>

          {/* Scrollable content */}
          <div className="app__modal_dialog_content ">
            <div className="flex flex-col lg:flex-row gap-6 min-w-0">
              {/* Left form */}
              <div className="w-full lg:max-w-[min(100%,22rem)] shrink-0 space-y-4 lg:border-r lg:pr-6">
                <div className="flex flex-col gap-1">
                  <Label className="app__formlabel_standard">Amount</Label>
                  <Input
                    className="app__input_standard"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                  />
                  <p className="text-xs text-gray-500">
                    Balance: ₱
                    {balance.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="app__formlabel_standard">
                    Payment Date
                  </Label>
                  <Input
                    className="app__input_standard"
                    type="date"
                    max={todayString()}
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="app__formlabel_standard">
                    Payment Method
                  </Label>
                  <Select
                    value={method}
                    onValueChange={(value) => {
                      setMethod(value);
                      // Reset cheque fields when method changes
                      if (value !== "Cheque") {
                        setChequeNumber("");
                        setBankName("");
                        setChequeDate("");
                      }
                      // Reset GL fields when method changes
                      if (value !== "GL") {
                        setGlNumber("");
                        setBillingAgency("");
                        setBeneficiaryName("");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="GCash">GCash</SelectItem>
                      <SelectItem value="Maya">Maya</SelectItem>
                      <SelectItem value="GL">GL</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="app__formlabel_standard">
                    Collection Receipt Number
                  </Label>
                  <Input
                    className="app__input_standard"
                    value={collectionReceiptNumber}
                    onChange={(e) => setCollectionReceiptNumber(e.target.value)}
                    placeholder="Enter collection receipt number"
                  />
                </div>

                {method === "Cheque" ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <Label className="app__formlabel_standard">
                        Check No.
                      </Label>
                      <Input
                        className="app__input_standard"
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        placeholder="Enter check number"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="app__formlabel_standard">
                        Bank Name
                      </Label>
                      <Input
                        className="app__input_standard"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="Enter bank name"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="app__formlabel_standard">
                        Check Date
                      </Label>
                      <Input
                        className="app__input_standard"
                        type="date"
                        value={chequeDate}
                        onChange={(e) => setChequeDate(e.target.value)}
                        required
                      />
                    </div>
                  </>
                ) : method === "GL" ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <Label className="app__formlabel_standard">
                        GL Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        className="app__input_standard"
                        value={glNumber}
                        onChange={(e) => setGlNumber(e.target.value)}
                        placeholder="Enter GL Number"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="app__formlabel_standard">
                        Name of Beneficiary
                      </Label>
                      <Input
                        className="app__input_standard"
                        value={beneficiaryName}
                        onChange={(e) => setBeneficiaryName(e.target.value)}
                        placeholder="Enter beneficiary name"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="app__formlabel_standard">
                        Billing Agency <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={billingAgency}
                        onValueChange={setBillingAgency}
                      >
                        <SelectTrigger className="app__input_standard">
                          <SelectValue placeholder="Select billing agency" />
                        </SelectTrigger>
                        <SelectContent>
                          {billingAgencies.map((agency) => (
                            <SelectItem key={agency} value={agency}>
                              {agency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-1">
                    <Label className="app__formlabel_standard">
                      Reference Number
                    </Label>
                    <Input
                      className="app__input_standard"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Reference Number"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <Label className="app__formlabel_standard">Remarks</Label>
                  <Input
                    className="app__input_standard"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Remarks"
                  />
                </div>

                <Button
                  className="w-full mt-3"
                  onClick={savePayment}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Payment"}
                </Button>
              </div>

              {/* Right payment history table */}
              <div className="min-w-0 flex-1">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">Payment History</h3>
                  {buildPrintData && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={printPaymentHistory}
                      className="flex items-center gap-1"
                    >
                      <Printer className="w-3 h-3" />
                      Print
                    </Button>
                  )}
                </div>
                <div className="border rounded-md overflow-auto max-h-[min(58vh,640px)]">
                  <table className="w-full min-w-[56rem] text-sm">
                    <thead className="bg-gray-100 text-gray-700 sticky top-0">
                      <tr>
                        <th className="p-2 border">Date</th>
                        <th className="p-2 border">Method</th>
                        <th className="p-2 border">Amount</th>
                        {hasChequePayment && (
                          <>
                            <th className="p-2 border">Check No.</th>
                            <th className="p-2 border">Bank Name</th>
                            <th className="p-2 border">Check Date</th>
                          </>
                        )}
                        {hasGLPayment && (
                          <>
                            <th className="p-2 border">GL Number</th>
                            <th className="p-2 border">Billing Agency</th>
                            <th className="p-2 border">Beneficiary</th>
                          </>
                        )}
                        <th className="p-2 border">Ref #</th>
                        <th className="p-2 border">Collection Receipt #</th>
                        <th className="p-2 border">Remarks</th>
                        <th className="p-2 border w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={totalCols}
                            className="text-center p-4 text-gray-500"
                          >
                            No payments yet
                          </td>
                        </tr>
                      ) : (
                        payments.map((p, i) => {
                          const isCheque = p.payment_method === "Cheque";
                          const isGL = p.payment_method === "GL";
                          // Pre-migration rows still carry the details as JSON
                          // in `remarks`.
                          const legacy =
                            isCheque || isGL ? legacyDetails(p) : null;
                          const chequeDateValue =
                            p.cheque_date || legacy?.cheque_date || null;

                          return (
                            <tr
                              key={p.id}
                              className={
                                i % 2 === 0 ? "bg-white" : "bg-gray-50"
                              }
                            >
                              <td className="p-2 border">
                                {p.payment_date
                                  ? new Date(p.payment_date).toLocaleString()
                                  : "-"}
                              </td>
                              <td className="p-2 border">
                                {p.payment_method || "-"}
                              </td>
                              <td className="p-2 border">
                                ₱
                                {Number(p.amount).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              {hasChequePayment && (
                                <>
                                  <td className="p-2 border">
                                    {isCheque
                                      ? p.reference_number ||
                                        legacy?.cheque_number ||
                                        "-"
                                      : "-"}
                                  </td>
                                  <td className="p-2 border">
                                    {isCheque
                                      ? p.bank_name || legacy?.bank_name || "-"
                                      : "-"}
                                  </td>
                                  <td className="p-2 border">
                                    {isCheque && chequeDateValue
                                      ? new Date(
                                          chequeDateValue
                                        ).toLocaleDateString()
                                      : "-"}
                                  </td>
                                </>
                              )}
                              {hasGLPayment && (
                                <>
                                  <td className="p-2 border">
                                    {isGL
                                      ? p.reference_number ||
                                        legacy?.gl_number ||
                                        "-"
                                      : "-"}
                                  </td>
                                  <td className="p-2 border">
                                    {isGL
                                      ? p.billing_agency ||
                                        legacy?.billing_agency ||
                                        "-"
                                      : "-"}
                                  </td>
                                  <td className="p-2 border">
                                    {isGL
                                      ? p.beneficiary_name ||
                                        legacy?.beneficiary_name ||
                                        "-"
                                      : "-"}
                                  </td>
                                </>
                              )}
                              <td className="p-2 border">
                                {!isCheque && !isGL
                                  ? p.reference_number || "-"
                                  : "-"}
                              </td>
                              <td className="p-2 border">
                                {p.collection_receipt_number || "-"}
                              </td>
                              <td className="p-2 border">
                                {(legacy ? null : p.remarks) || "-"}
                              </td>
                              <td className="p-2 border text-center">
                                <button
                                  onClick={() => setPaymentToRemove(p)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-sm space-y-1">
                  <p>
                    Total Paid:{" "}
                    <b className="text-green-700">
                      ₱
                      {totalPaid.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </b>
                  </p>
                  <p>
                    Remaining Balance:{" "}
                    <b className="text-red-600">
                      ₱
                      {balance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </b>
                  </p>
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="app__modal_dialog_footer">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogPanel>
      </div>

      <ConfirmationModal
        isOpen={paymentToRemove !== null}
        onClose={() => setPaymentToRemove(null)}
        onConfirm={async () => {
          if (paymentToRemove) await removePayment(paymentToRemove);
        }}
        message="Remove this payment? The payment status will be recalculated."
      />

      {typeof window !== "undefined" &&
        createPortal(<PaymentHistoryPrint data={printData} />, document.body)}
    </Dialog>
  );
};
