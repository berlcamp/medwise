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

// Transaction types counted by sales/profit reports. Excludes retail and
// consignment hand-offs (consignment_add). Agent hand-offs create no
// transaction row, so nothing to exclude there.
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
