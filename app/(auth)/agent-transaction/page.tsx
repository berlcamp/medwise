/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Notfoundpage from "@/components/Notfoundpage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppSelector } from "@/lib/redux/hook";
import { supabase } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/utils";
import { generateTransactionNumber, recordAgentSale } from "@/lib/utils/agent";
import { AgentItem, Customer } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function AgentTransactionPage() {
  const user = useAppSelector((state) => state.user.user);
  const router = useRouter();
  const [agent, setAgent] = useState<any>(null);
  const [agentItems, setAgentItems] = useState<AgentItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedItems, setSelectedItems] = useState<{ [key: number]: number }>(
    {}
  );
  const [customerId, setCustomerId] = useState<string>("");
  const [paymentType, setPaymentType] = useState<string>("Cash");
  const [paymentStatus, setPaymentStatus] = useState<string>("Unpaid");
  const [glNumber, setGlNumber] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      if (!user?.email) return;

      setLoading(true);
      try {
        // Find agent by email
        const { data: agentData, error: agentError } = await supabase
          .from("agents")
          .select("*")
          .eq("email", user.email)
          .eq("status", "active")
          .maybeSingle();

        if (agentError || !agentData) {
          console.error("Agent not found:", agentError);
          setLoading(false);
          return;
        }

        setAgent(agentData);

        // Load agent items with available balance
        const { data: itemsData, error: itemsError } = await supabase
          .from("agent_items")
          .select(
            `
            *,
            product:products (id, name, unit, selling_price)
          `
          )
          .eq("agent_id", agentData.id)
          .gt("current_balance", 0);

        if (itemsError) {
          console.error("Error loading agent items:", itemsError);
        } else {
          setAgentItems(itemsData || []);
        }

        // Load customers
        const { data: customersData, error: customersError } = await supabase
          .from("customers")
          .select("*")
          .order("name", { ascending: true });

        if (customersError) {
          console.error("Error loading customers:", customersError);
        } else {
          setCustomers(customersData || []);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.email]);

  // Restrict access - only agents
  if (user?.type !== "agent") return <Notfoundpage />;

  const handleQuantityChange = (itemId: number, quantity: number) => {
    const item = agentItems.find((i) => i.id === itemId);
    if (!item) return;

    const maxQuantity = item.current_balance;
    const clampedQuantity = Math.min(Math.max(0, quantity), maxQuantity);

    setSelectedItems({
      ...selectedItems,
      [itemId]: clampedQuantity,
    });
  };

  const calculateTotal = () => {
    return Object.entries(selectedItems).reduce((sum, [itemId, qty]) => {
      if (qty <= 0) return sum;
      const item = agentItems.find((i) => i.id === Number(itemId));
      if (!item) return sum;
      return sum + qty * item.unit_price;
    }, 0);
  };

  const handleSubmit = async () => {
    const itemsToSell = Object.entries(selectedItems)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = agentItems.find((i) => i.id === Number(itemId));
        return {
          product_id: item!.product_id,
          quantity: qty,
          price: item!.unit_price,
        };
      });

    if (itemsToSell.length === 0) {
      toast.error("Please select at least one item to sell");
      return;
    }

    if (!customerId) {
      toast.error("Please select a customer");
      return;
    }

    if (paymentType === "GL" && !glNumber) {
      toast.error("Please enter GL number");
      return;
    }

    setSubmitting(true);

    try {
      const transactionNumber = await generateTransactionNumber();

      const selectedCustomer = customers.find(
        (c) => c.id.toString() === customerId
      );
      if (!selectedCustomer) {
        toast.error("Customer not found");
        return;
      }

      const result = await recordAgentSale({
        agent_id: agent.id,
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        items: itemsToSell,
        transaction_number: transactionNumber,
        payment_type: paymentType === "GL" ? `GL-${glNumber}` : paymentType,
        payment_status: paymentStatus,
        created_by: user?.name || "System",
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to create transaction");
      }

      toast.success("Transaction created successfully!");
      router.push("/agent-dashboard");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create transaction");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-lg rounded-xl p-12 text-center border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Agent Not Found
            </h3>
            <p className="text-gray-500">
              No active agent record found for your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const total = calculateTotal();
  const hasSelectedItems = Object.values(selectedItems).some((qty) => qty > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-lg rounded-xl border border-gray-100 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Create Transaction
            </h1>
            <p className="text-gray-500 mt-1">
              Select items from your inventory to create a transaction
            </p>
          </div>

          {/* Customer Selection */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer <span className="text-red-500">*</span>
              </label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem
                      key={customer.id}
                      value={customer.id.toString()}
                    >
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Type
              </label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="GCash">GCash</SelectItem>
                  <SelectItem value="GL">GL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentType === "GL" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GL Number <span className="text-red-500">*</span>
                </label>
                <Input
                  value={glNumber}
                  onChange={(e) => setGlNumber(e.target.value)}
                  placeholder="Enter GL number"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Status
              </label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Available Items
            </h2>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Available</TableHead>
                    <TableHead className="text-center">Unit Price</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-gray-500"
                      >
                        No items available
                      </TableCell>
                    </TableRow>
                  ) : (
                    agentItems.map((item: AgentItem) => {
                      const quantity = selectedItems[item.id] || 0;
                      const subtotal = quantity * item.unit_price;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {item.product?.name || "Unknown"}
                              </div>
                              {item.batch_no && (
                                <div className="text-xs text-gray-500">
                                  Batch: {item.batch_no}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-semibold">
                              {item.current_balance}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {formatMoney(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min="0"
                              max={item.current_balance}
                              value={quantity}
                              onChange={(e) =>
                                handleQuantityChange(
                                  item.id,
                                  Number(e.target.value)
                                )
                              }
                              className="w-20 mx-auto"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {quantity > 0 ? formatMoney(subtotal) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Total and Actions */}
          <div className="border-t pt-4 flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatMoney(total)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/agent-dashboard")}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="green"
                onClick={handleSubmit}
                disabled={submitting || !hasSelectedItems || !customerId}
              >
                {submitting ? "Creating..." : "Create Transaction"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
