export const PER_PAGE = 20

export const productCategories = [
  'Non-Pharmaceutical Products',
  'Over-the-Counter (OTC) Drugs',
  'Behind-the-Counter (BTC) Drugs',
  'Cold Chain Item',
  'Controlled Substances',
  'Food Supplement',
  'Prescription Medications (Rx)'
]

export const productSubcategories: Record<string, string[]> = {
  'Non-Pharmaceutical Products': [
    'Medical Devices / Equipment',
    'Wound Care',
    'Personal Care / Hygiene',
    'Durable Medical Equipment (DME)'
  ],
  'Over-the-Counter (OTC) Drugs': [
    'Solids (Tablets, Capsules, Powder)',
    'Liquids (Syrups, Suspension, Solution, Drops)',
    'Topical (Creams, Ointments, Gel, Patches)',
    'Inhalers / Aerosols (MDIs, Nebulizer Solutions)'
  ],
  // Categories with no subcategories yet:
  'Behind-the-Counter (BTC) Drugs': [],
  'Cold Chain Item': [],
  'Controlled Substances': [],
  'Food Supplement': [],
  'Prescription Medications (Rx)': []
}

export const productUnits = [
  // 💊 Solid Forms
  'tablet',
  'tab',
  'capsule',
  'cap',
  'piece',
  'pc',
  'strip',
  'blister',
  'pack',
  'box',
  'bottle',

  // 🧴 Liquid Forms
  'nebule',
  'ml',
  'l',
  'vial',
  'ampoule',
  'amp',
  'tube',
  'sachet',

  // 💉 Injectables / Parenterals
  'syringe',
  'kit',

  // 🧫 Topical / Dermatologic
  'jar',
  'drop',
  'gtt',
  'spray',

  // 🩹 Medical Supplies & Devices
  'set',
  'roll',

  // ⚖️ Measurement Units
  'mg',
  'g',
  'mcg',
  'iu'
]
export const procedureCategories = [
  'Drip',
  'Slimming, Toning & Contouring',
  'Facial',
  'Whitening & Rejuvenating'
]
