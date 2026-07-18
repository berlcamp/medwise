"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesReport from "@/components/reports/SalesReport";
import { ProfitReport } from "@/components/reports/ProfitReport";
import { DailySalesSummary } from "@/components/reports/DailySalesSummary";
import type { ReportChannel } from "@/lib/constants";

export function ChannelReports({
  channel,
  isAdmin,
}: {
  channel: ReportChannel;
  isAdmin: boolean;
}) {
  const [sub, setSub] = useState("sales");

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
      </div>
    </Tabs>
  );
}
