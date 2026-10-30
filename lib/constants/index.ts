export const PER_PAGE = 20;

export const billingAgencies = [
  "DEPARTMENT OF SOCIAL WELFARE AND DEVELOPMENT (DSWD)",
  "LGU - SAN FRANCISCO",
  "PLGU - AGUSAN DEL SUR",
];

export const productCategories = [
  "Non-Pharmaceutical Products",
  "Over-the-Counter (OTC) Drugs",
  "Behind-the-Counter (BTC) Drugs",
  "Cold Chain Item",
  "Controlled Substances",
  "Food Supplement",
  "Prescription Medications (Rx)",
];

export const productSubcategories: Record<string, string[]> = {
  "Non-Pharmaceutical Products": [
    "Medical Devices / Equipment",
    "Wound Care",
    "Personal Care / Hygiene",
    "Durable Medical Equipment (DME)",
  ],
  "Over-the-Counter (OTC) Drugs": [
    "Solids (Tablets, Capsules, Powder)",
    "Liquids (Syrups, Suspension, Solution, Drops)",
    "Topical (Creams, Ointments, Gel, Patches)",
    "Inhalers / Aerosols (MDIs, Nebulizer Solutions)",
  ],
  // Categories with no subcategories yet:
  "Behind-the-Counter (BTC) Drugs": [],
  "Cold Chain Item": [],
  "Controlled Substances": [],
  "Food Supplement": [],
  "Prescription Medications (Rx)": [],
};

export const productUnits = [
  // 💊 Solid Forms
  "tablet",
  "tab",
  "capsule",
  "cap",
  "piece",
  "pc",
  "strip",
  "blister",
  "pack",
  "box",
  "bottle",

  // 🧴 Liquid Forms
  "nebule",
  "ml",
  "l",
  "vial",
  "ampoule",
  "amp",
  "tube",
  "sachet",

  // 💉 Injectables / Parenterals
  "syringe",
  "kit",

  // 🧫 Topical / Dermatologic
  "jar",
  "drop",
  "gtt",
  "spray",

  // 🩹 Medical Supplies & Devices
  "set",
  "roll",

  // ⚖️ Measurement Units
  "mg",
  "g",
  "mcg",
  "iu",
];
export const procedureCategories = [
  "Drip",
  "Slimming, Toning & Contouring",
  "Facial",
  "Whitening & Rejuvenating",
];

// ===============================
// REPORTS — sales channel scoping
// ===============================
export type ReportChannel = "bulk" | "consignment" | "agent";

// Transaction types counted by sales/profit reports. Excludes consignment
// hand-offs (consignment_add). Agent hand-offs create no transaction row,
// so nothing to exclude there.
export const REPORTABLE_SALE_TYPES: string[] = [
  "bulk",
  "consignment_sale",
  "agent_sale",
];

// One channel tab → its transaction_type.
export const CHANNEL_TX_TYPE: Record<ReportChannel, string> = {
  bulk: "bulk",
  consignment: "consignment_sale",
  agent: "agent_sale",
};

// ===============================
// EXPENSES
// ===============================
// Expense categories are admin-editable and live in the
// `medwise.expense_categories` table — see lib/utils/expenseCategories.ts.
export const expensePaymentMethods = [
  "Cash",
  "Bank Transfer",
  "Check",
  "GCash",
];

// ===============================
// REPORTS — per-user tab access
// ===============================
// Every report a staff account can be granted from the Staff modal. "profit"
// is the Profit sub-tab inside the Bulk/Consignment/Agent channel tabs.
export const REPORT_ACCESS_OPTIONS = [
  { value: "bulk", label: "Bulk" },
  { value: "consignment", label: "Consignment" },
  { value: "agent", label: "Agent" },
  { value: "profit", label: "Profit (channel sub-tab)" },
  { value: "customer", label: "Customer Sales" },
  { value: "product", label: "Product Performance" },
  { value: "payment", label: "Payment Methods" },
  { value: "gl", label: "GL Transactions" },
  { value: "expenses", label: "Expenses" },
  { value: "salesvsexpenses", label: "Sales vs Collection vs Expenses" },
  { value: "inventory", label: "Inventory" },
  { value: "expiry", label: "Expiry Report" },
  { value: "stockcard", label: "Stock Movements" },
] as const;

export type ReportAccessKey = (typeof REPORT_ACCESS_OPTIONS)[number]["value"];

const ALL_REPORT_KEYS: ReportAccessKey[] = REPORT_ACCESS_OPTIONS.map(
  (r) => r.value
);

// What each role gets when no explicit list has been saved for the user.
export function getDefaultReportAccess(type?: string): ReportAccessKey[] {
  if (type === "admin" || type === "super admin") return ALL_REPORT_KEYS;
  if (type === "bulk") return ["expenses", "inventory", "expiry", "stockcard"];
  return [];
}

// Effective report access: super admins always see everything, cashiers see
// nothing, everyone else uses their saved list (or the role default if none).
export function getReportAccess(
  type?: string,
  reportAccess?: string[] | null
): ReportAccessKey[] {
  if (type === "super admin") return ALL_REPORT_KEYS;
  if (type === "cashier") return [];
  if (!reportAccess) return getDefaultReportAccess(type);
  return ALL_REPORT_KEYS.filter((k) => reportAccess.includes(k));
}
