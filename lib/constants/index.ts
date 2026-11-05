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

// ===============================
// MODULES — per-user page access
// ===============================
// Every module a Bulk/Admin account can be granted from the Staff modal, with
// the routes it covers (list page plus its create/edit form page). Home is open
// to everyone; Branches and System Settings stay super-admin-only.
export const MODULE_ACCESS_OPTIONS = [
  { value: "dashboard", label: "Dashboard", routes: ["/dashboard"] },
  {
    value: "bulktransactions",
    label: "Bulk Transactions",
    routes: ["/bulktransactions", "/bulktransaction"],
  },
  {
    value: "consignments",
    label: "Consignments",
    routes: ["/consignments", "/consignment"],
  },
  { value: "agents", label: "Agents", routes: ["/agents", "/agent"] },
  {
    value: "quotations",
    label: "Quotations",
    routes: ["/quotations", "/quotation"],
  },
  { value: "customers", label: "Customers", routes: ["/customers"] },
  { value: "products", label: "Products", routes: ["/products"] },
  { value: "productstocks", label: "Stocks in/out", routes: ["/productstocks"] },
  { value: "suppliers", label: "Suppliers", routes: ["/suppliers"] },
  { value: "expenses", label: "Expenses", routes: ["/expenses"] },
  { value: "reports", label: "Reports", routes: ["/reports"] },
  { value: "staff", label: "Staff", routes: ["/staff"] },
] as const;

export type ModuleAccessKey = (typeof MODULE_ACCESS_OPTIONS)[number]["value"];

export const ALL_MODULE_KEYS: ModuleAccessKey[] = MODULE_ACCESS_OPTIONS.map(
  (m) => m.value
);

// Effective module access: only Bulk and Admin accounts are limited by a saved
// list (no list means all modules). Other roles keep their own page-level rules.
export function getModuleAccess(
  type?: string,
  moduleAccess?: string[] | null
): ModuleAccessKey[] {
  if ((type !== "bulk" && type !== "admin") || !moduleAccess) {
    return ALL_MODULE_KEYS;
  }
  return ALL_MODULE_KEYS.filter((k) => moduleAccess.includes(k));
}

// Whether a path may be opened. Paths outside every module are always allowed.
export function canAccessPath(
  pathname: string,
  type?: string,
  moduleAccess?: string[] | null
): boolean {
  const match = MODULE_ACCESS_OPTIONS.find((m) =>
    m.routes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    )
  );
  return !match || getModuleAccess(type, moduleAccess).includes(match.value);
}
