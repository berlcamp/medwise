"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/utils";
import { ProductStock } from "@/types";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { format, isBefore, isValid, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Already-loaded stock row. Takes precedence over `stockId`. */
  stock?: ProductStock | null;
  /** Batch to load when the caller only has the product_stock_id at hand. */
  stockId?: number | null;
}

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, "MMM dd, yyyy") : "-";
};

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <p className="text-gray-500 text-xs">{label}</p>
    <div className="font-semibold break-words">{children}</div>
  </div>
);

export function StockBatchDetailsModal({
  isOpen,
  onClose,
  stock,
  stockId,
}: Props) {
  const [fetched, setFetched] = useState<ProductStock | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only fetch when the caller passed an id instead of the full row.
    if (!isOpen || stock || !stockId) {
      setFetched(null);
      return;
    }

    let isMounted = true;

    const fetchStock = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("product_stocks")
        .select(
          `
          *,
          product:products ( id, name, category, unit ),
          supplier:supplier_id ( name )
        `
        )
        .eq("id", stockId)
        .single();

      if (!isMounted) return;

      if (error) {
        console.error(error);
        toast.error("Failed to load batch details");
      } else {
        setFetched(data as ProductStock);
      }
      setLoading(false);
    };

    fetchStock();

    return () => {
      isMounted = false;
    };
  }, [isOpen, stock, stockId]);

  const item = stock || fetched;

  const expDate = item?.expiration_date ? parseISO(item.expiration_date) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isExpired =
    expDate && isValid(expDate) ? isBefore(expDate, today) : false;

  return (
    <Dialog
      open={isOpen}
      as="div"
      className="relative z-[60] focus:outline-none"
      onClose={onClose}
    >
      <div className="fixed inset-0 bg-gray-600 opacity-80" aria-hidden="true" />

      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-lg"
        >
          <div className="sticky top-0 z-10 bg-white border-b px-6 py-4">
            <DialogTitle as="h3" className="text-base font-medium">
              Batch Details
            </DialogTitle>
          </div>

          <div className="px-6 py-4 text-sm">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : !item ? (
              <p className="text-gray-500">Batch details not found.</p>
            ) : (
              <>
                <div className="border-b pb-4 mb-4">
                  <p className="text-lg font-semibold">
                    {item.product?.name || "Unknown Product"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.product?.category || "-"}
                    {item.product?.unit && <> &bull; Unit: {item.product.unit}</>}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Batch No.">{item.batch_no || "-"}</Field>
                  <Field label="Supplier">{item.supplier?.name || "-"}</Field>
                  <Field label="Manufacturer">{item.manufacturer || "-"}</Field>
                  <Field label="Date Manufactured">
                    {formatDate(item.date_manufactured)}
                  </Field>
                  <Field label="Expiration Date">
                    <span className="inline-flex items-center gap-2">
                      {formatDate(item.expiration_date)}
                      {isExpired && <Badge variant="red">Expired</Badge>}
                    </span>
                  </Field>
                  <Field label="Date Received">
                    {formatDate(item.transaction_date || item.created_at)}
                  </Field>
                  <Field label="Quantity Received">{item.quantity ?? "-"}</Field>
                  <Field label="Remaining Stocks">
                    {item.remaining_quantity ?? "-"}
                  </Field>
                  <Field label="Consigned Quantity">
                    {item.consigned_quantity ?? 0}
                  </Field>
                  <Field label="Purchase Cost">
                    {formatMoney(item.purchase_price)}
                  </Field>
                  <Field label="Reorder Point">
                    {item.reorder_point ?? "-"}
                  </Field>
                  <Field label="Inventory Type">
                    {item.inventory_type || "-"}
                  </Field>
                </div>

                {item.remarks && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-xs">Remarks</p>
                    <p>{item.remarks}</p>
                  </div>
                )}
              </>
            )}

            <div className="mt-6 flex justify-end border-t pt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
