"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesReport from "@/components/reports/SalesReport";
import { ProfitReport } from "@/components/reports/ProfitReport";
import { DailySalesSummary } from "@/components/reports/DailySalesSummary";
import { ConsignmentPaymentsReport } from "@/components/reports/ConsignmentPaymentsReport";
import type { ReportChannel } from "@/lib/constants";

export function ChannelReports({
  channel,
  isAdmin,
}: {
  channel: ReportChannel;
  isAdmin: boolean;
}) {
  const [sub, setSub] = useState("sales");

  // Consignment collections live in their own ledger (`consignment_payments`),
  // keyed to the consignment rather than to a sale transaction, so they need
  // their own tab — the sales tables cannot show them.
  const hasPayments = channel === "consignment";

  return (
    <Tabs value={sub} onValueChange={setSub} className="w-full">
      <TabsList className="inline-flex gap-2 h-auto p-1 bg-gray-100">
        <TabsTrigger value="sales" className="px-4 py-2">
          Sales
        </TabsTrigger>
        {isAdmin && (
          <TabsTrigger value="profit" className="px-4 py-2">
            Profit
          </TabsTrigger>
        )}
        <TabsTrigger value="daily" className="px-4 py-2">
          Daily
        </TabsTrigger>
        {hasPayments && (
          <TabsTrigger value="payments" className="px-4 py-2">
            Payments
          </TabsTrigger>
        )}
      </TabsList>

      <div className="mt-4">
        <TabsContent value="sales" className="mt-0">
          <SalesReport channel={channel} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="profit" className="mt-0">
            <ProfitReport channel={channel} />
          </TabsContent>
        )}
        <TabsContent value="daily" className="mt-0">
          <DailySalesSummary channel={channel} />
        </TabsContent>
        {hasPayments && (
          <TabsContent value="payments" className="mt-0">
            <ConsignmentPaymentsReport />
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}
