/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ReceivePaymentModal } from "@/app/(auth)/bulktransactions/PaymentStatusDropdown";
import { TransactionDetailsModal } from "@/app/(auth)/bulktransactions/TransactionDetailsModal";
import Notfoundpage from "@/components/Notfoundpage";
import { DeliveryReceiptPrint } from "@/components/printables/DeliveryReceiptPrint";
import { InvoicePrint } from "@/components/printables/InvoicePrint";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { AgentItem, Transaction } from "@/types";
import { format } from "date-fns";
import { ChevronDown, CreditCard, Eye, FileText, Printer } from "lucide-react";
import { useEffect, useState } from "react";

export default function AgentDashboardPage() {
  const user = useAppSelector((state) => state.user.user);
  const [agent, setAgent] = useState<any>(null);
  const [agentItems, setAgentItems] = useState<AgentItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Transaction list states
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [printData, setPrintData] = useState<any>(null);
  const [printDeliveryData, setPrintDeliveryData] = useState<any>(null);
  const [printType, setPrintType] = useState<"invoice" | "delivery" | null>(
    null
  );

  useEffect(() => {
    const loadAgentData = async () => {
      if (!user?.email) return;

      setLoading(true);
      try {
        // Find agent by matching user email
        const { data: agentData, error: agentError } = await supabase
          .from("agents")
          .select("*")
          .eq("email", user.email)
          .eq("status", "active")
          .maybeSingle();

        if (agentError) {
          console.error("Error loading agent:", agentError);
          setLoading(false);
          return;
        }

        if (!agentData) {
          console.error("Agent not found for user:", user.email);
          setLoading(false);
          return;
        }

        setAgent(agentData);

        // Load agent items
        const { data: itemsData, error: itemsError } = await supabase
          .from("agent_items")
          .select(
            `
            *,
            product:products (id, name, unit, selling_price)
          `
          )
          .eq("agent_id", agentData.id);

        if (itemsError) {
          console.error("Error loading agent items:", itemsError);
        } else {
          setAgentItems(itemsData || []);
        }

        // Load transactions for this agent
        // Match by transaction_type='agent_sale' and agent_id
        const { data: transactionsData, error: transactionsError } =
          await supabase
            .from("transactions")
            .select("*, customer:customer_id(name,address)")
            .eq("transaction_type", "agent_sale")
            .eq("agent_id", agentData.id)
            .order("created_at", { ascending: false });

        if (transactionsError) {
          console.error("Error loading transactions:", transactionsError);
        } else {
          setTransactions(transactionsData || []);
        }
      } catch (error) {
        console.error("Error loading agent data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAgentData();
  }, [user?.email]);

  // Restrict access - only agents
  if (user?.type !== "agent") return <Notfoundpage />;

  // Calculate summary statistics
  const totalItemsAdded = agentItems.reduce(
    (sum, i) => sum + i.quantity_added,
    0
  );
  const totalItemsSold = agentItems.reduce(
    (sum, i) => sum + i.quantity_sold,
    0
  );
  const totalItemsReturned = agentItems.reduce(
    (sum, i) => sum + i.quantity_returned,
    0
  );
  const totalCurrentBalance = agentItems.reduce(
    (sum, i) => sum + i.current_balance,
    0
  );
  const totalValue = agentItems.reduce((sum, i) => sum + i.total_value, 0);

  // Filter returned items
  const returnedItems = agentItems.filter((item) => item.quantity_returned > 0);

  const printInvoice = async (item: Transaction) => {
    setPrintData(null);
    setPrintDeliveryData(null);
    setPrintType(null);

    const { data: items, error: itemsError } = await supabase
      .from("transaction_items")
      .select(`*, product:product_id(name)`)
      .eq("transaction_id", item.id);

    if (itemsError) {
      console.error(itemsError);
      return;
    }

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

    const transactionWithCustomer = {
      ...item,
      customer: customerData,
    };

    setPrintData({ transaction: transactionWithCustomer, items });
    setPrintType("invoice");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintData(null);
        setPrintDeliveryData(null);
        setPrintType(null);
      }, 500);
    }, 200);
  };

  const printDeliveryReceipt = async (item: Transaction) => {
    setPrintData(null);
    setPrintDeliveryData(null);
    setPrintType(null);

    const { data: items, error: itemsError } = await supabase
      .from("transaction_items")
      .select(`*, product:product_id(name)`)
      .eq("transaction_id", item.id);

    if (itemsError) {
      console.error(itemsError);
      return;
    }

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

    const transactionWithCustomer = {
      ...item,
      customer: customerData,
    };

    setPrintDeliveryData({ transaction: transactionWithCustomer, items });
    setPrintType("delivery");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintData(null);
        setPrintDeliveryData(null);
        setPrintType(null);
      }, 500);
    }, 200);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Agent Dashboard
            </h1>
            <p className="text-gray-500 mt-1">Welcome, {agent.name}</p>
          </div>
        </div>

        {/* Summary Widgets */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-600">Items Added</p>
            <p className="text-xl font-bold text-green-900">
              {totalItemsAdded}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Items Sold</p>
            <p className="text-xl font-bold text-orange-900">
              {totalItemsSold}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Items Returned</p>
            <p className="text-xl font-bold text-purple-900">
              {totalItemsReturned}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Current Balance</p>
            <p className="text-xl font-bold text-gray-900">
              {totalCurrentBalance}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Value</p>
            <p className="text-xl font-bold">{formatMoney(totalValue)}</p>
          </div>
        </div>

        {/* Item Overview Table */}
        <div className="bg-white shadow-lg rounded-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
            <h3 className="font-bold text-lg text-white">Item Overview</h3>
          </div>
          <div className="p-4">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Added</TableHead>
                    <TableHead className="text-center">Sold</TableHead>
                    <TableHead className="text-center">Returned</TableHead>
                    <TableHead className="text-center">Current</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-gray-500"
                      >
                        No items found
                      </TableCell>
                    </TableRow>
                  ) : (
                    agentItems.map((item: AgentItem) => (
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
                          {item.quantity_added > 0 ? (
                            <span className="text-green-600 font-medium">
                              +{item.quantity_added}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantity_sold > 0 ? (
                            <span className="text-orange-600 font-medium">
                              -{item.quantity_sold}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantity_returned > 0 ? (
                            <span className="text-purple-600 font-medium">
                              -{item.quantity_returned}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">
                            {item.current_balance}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(item.total_value)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Returned Items List */}
        {returnedItems.length > 0 && (
          <div className="bg-white shadow-lg rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
              <h3 className="font-bold text-lg text-white">Returned Items</h3>
            </div>
            <div className="p-4">
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">
                        Quantity Returned
                      </TableHead>
                      <TableHead className="text-center">Batch No.</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnedItems.map((item: AgentItem) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">
                            {item.product?.name || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-purple-600 font-medium">
                            {item.quantity_returned}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.batch_no || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(item.unit_price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* Transactions List */}
        <div className="bg-white shadow-lg rounded-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
            <h3 className="font-bold text-lg text-white">My Transactions</h3>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="app__table">
                <thead className="app__thead">
                  <tr>
                    <th className="app__th">Transaction No.</th>
                    <th className="app__th">Customer</th>
                    <th className="app__th">Payment Method</th>
                    <th className="app__th text-right">Amount</th>
                    <th className="app__th text-center">Payment Status</th>
                    <th className="app__th text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="app__td text-center text-gray-500"
                      >
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    transactions.map((item: Transaction) => (
                      <tr key={item.id} className="app__tr">
                        <td className="app__td">
                          <div>
                            <div className="font-semibold">
                              {item.transaction_number}
                            </div>
                            <div className="text-xs text-gray-500">
                              {item.created_at &&
                                format(
                                  new Date(item.created_at),
                                  "MMM dd, yyyy"
                                )}
                            </div>
                          </div>
                        </td>
                        <td className="app__td">{item.customer_name || "-"}</td>
                        <td className="app__td">
                          <div>
                            <span className="font-medium">
                              {item.payment_type || "-"}
                            </span>
                            {item.payment_type === "GL" && (
                              <div className="text-xs text-gray-500">
                                GL: {item.gl_number || "-"}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="app__td text-right">
                          <span className="font-semibold text-gray-900">
                            ₱
                            {Number(item.total_amount || 0).toLocaleString(
                              "en-US",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </span>
                        </td>
                        <td className="app__td text-center">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              item.payment_status === "Paid"
                                ? "bg-green-100 text-green-800"
                                : item.payment_status === "Partial"
                                  ? "bg-orange-100 text-orange-800"
                                  : item.payment_status === "Unpaid"
                                    ? "bg-red-100 text-red-800"
                                    : item.payment_status === "Pending"
                                      ? "bg-orange-100 text-orange-800"
                                      : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {item.payment_status?.toUpperCase() || "-"}
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
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedTransaction(item);
                                  setIsTransactionModalOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedTransaction(item);
                                  setIsPaymentOpen(true);
                                }}
                              >
                                <CreditCard className="w-4 h-4 mr-2" />
                                Manage Payments
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => printInvoice(item)}
                              >
                                <Printer className="w-4 h-4 mr-2" />
                                Print Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => printDeliveryReceipt(item)}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Print Delivery Receipt
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedTransaction && (
        <>
          <TransactionDetailsModal
            isOpen={isTransactionModalOpen}
            onClose={() => {
              setIsTransactionModalOpen(false);
              setSelectedTransaction(null);
            }}
            transaction={selectedTransaction}
          />
          <ReceivePaymentModal
            transaction={selectedTransaction}
            isOpen={isPaymentOpen}
            onClose={() => {
              setIsPaymentOpen(false);
            }}
          />
        </>
      )}

      {/* Print Components */}
      {printType === "invoice" && printData && (
        <InvoicePrint key="invoice" data={printData} />
      )}
      {printType === "delivery" && printDeliveryData && (
        <DeliveryReceiptPrint key="delivery" data={printDeliveryData} />
      )}
    </div>
  );
}
