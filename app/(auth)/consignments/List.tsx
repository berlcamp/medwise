/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { ConsignmentPrint } from "@/components/printables/ConsignmentPrint";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase/client";
import { formatConsignmentPeriod } from "@/lib/utils/consignment";
import { Consignment, RootState } from "@/types";
import { format } from "date-fns";
import { ChevronDown, Printer, Settings } from "lucide-react";
import { useState } from "react";
import Avatar from "react-avatar";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { ConsignmentDetailsModal } from "./ConsignmentDetailsModal";

export const List = () => {
  const list = useSelector((state: RootState) => state.list.value);
  const [selectedItem, setSelectedItem] = useState<Consignment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [printData, setPrintData] = useState<any>(null);

  const handleView = (item: Consignment) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const printConsignment = async (item: Consignment) => {
    // Load consignment items with product data
    const { data: items, error: itemsError } = await supabase
      .from("consignment_items")
      .select(`*, product:product_id(name, unit)`)
      .eq("consignment_id", item.id);

    if (itemsError) {
      console.error(itemsError);
      toast.error("Failed to load consignment items");
      return;
    }

    // Load customer data if customer_id exists
    let customerData = null;
    if (item.customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", item.customer_id)
        .single();

      if (!customerError && customer) {
        customerData = customer;
      }
    }

    // Combine consignment data with customer
    const consignmentWithCustomer = {
      ...item,
      customer: customerData,
    };

    setPrintData({ consignment: consignmentWithCustomer, items: items || [] });

    // Use requestAnimationFrame to ensure DOM is updated before printing
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.print();
          setTimeout(() => {
            setPrintData(null);
          }, 500);
        }, 100);
      });
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="app__table">
        <thead className="app__thead">
          <tr>
            <th className="app__th">Consignment No.</th>
            <th className="app__th">Customer</th>
            <th className="app__th">Period</th>
            <th className="app__th text-center">Previous Balance</th>
            <th className="app__th text-center">New Items</th>
            <th className="app__th text-center">Sold</th>
            <th className="app__th text-center">Current Balance</th>
            <th className="app__th text-right">Balance Due</th>
            <th className="app__th text-center">Status</th>
            <th className="app__th text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item: Consignment) => (
            <tr key={item.id} className="app__tr">
              <td className="app__td">
                <div>
                  <div className="font-semibold">{item.consignment_number}</div>
                  <div className="text-xs text-gray-500">
                    {item.created_at &&
                      format(new Date(item.created_at), "MMM dd, yyyy")}
                  </div>
                </div>
              </td>
              <td className="app__td">
                {item.customer ? (
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={item.customer.name}
                      size="30"
                      round={true}
                      textSizeRatio={3}
                      className="shrink-0"
                    />
                    <span className="text-gray-800 font-medium">
                      {item.customer.name}
                    </span>
                  </div>
                ) : (
                  <span>{item.customer_name}</span>
                )}
              </td>
              <td className="app__td">
                <span className="font-medium">
                  {formatConsignmentPeriod(item.month, item.year)}
                </span>
              </td>
              <td className="app__td text-center">
                {item.previous_balance_qty > 0 ? (
                  <span className="text-blue-600 font-medium">
                    {item.previous_balance_qty}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="app__td text-center">
                {item.new_items_qty > 0 ? (
                  <span className="text-green-600 font-medium">
                    +{item.new_items_qty}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="app__td text-center">
                {item.sold_qty > 0 ? (
                  <span className="text-orange-600 font-medium">
                    -{item.sold_qty}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="app__td text-center">
                <span className="font-semibold text-gray-900">
                  {item.current_balance_qty}
                </span>
              </td>
              <td className="app__td text-right">
                {item.balance_due > 0 ? (
                  <span className="text-red-600 font-semibold">
                    ₱
                    {Number(item.balance_due).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                ) : (
                  <span className="text-gray-400">₱0.00</span>
                )}
              </td>
              <td className="app__td text-center">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    item.status === "active"
                      ? "bg-green-100 text-green-800"
                      : item.status === "settled"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {item.status?.toUpperCase() || "-"}
                </span>
              </td>
              <td className="app__td text-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="xs" variant="blue">
                      Actions
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleView(item)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Manage
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => printConsignment(item)}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print Summary
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedItem && (
        <ConsignmentDetailsModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            // Refresh list after closing modal
            window.location.reload();
          }}
          consignment={selectedItem}
        />
      )}

      <ConsignmentPrint data={printData} />
    </div>
  );
};
