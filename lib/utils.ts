import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { supabase } from './supabase/client'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatMoney = (amount: number | string) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(Number(amount) || 0)
}

const CATEGORY_CODES: Record<string, string> = {
  'Over-the-Counter (OTC) Drugs': 'OTC',
  'Prescription Medications (Rx)': 'RX',
  'Behind-the-Counter (BTC) Drugs': 'BTC',
  'Cold Chain Item': 'CCI',
  'Food Supplement': 'FS',
  'Non-Pharmaceutical Products': 'NPP'
}

/**
 * Generate a unique SKU for a product.
 * @param product - product data
 * @param table - table name ('products')
 * @returns string - generated SKU
 */
export const generateSKU = async (product: {
  name: string
  category: string
  subcategory?: string
  unit: string
}) => {
  // Category code (first letters of each word)
  const categoryCode = CATEGORY_CODES[product.category] || 'GEN'
  // Subcategory code (first letters) or default
  const subcategoryCode = product.subcategory
    ? product.subcategory
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'GEN'

  // Product name initials (first 3 letters)
  const nameCode = product.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3)

  // Unit code (first 2 letters)
  const unitCode = product.unit.slice(0, 2).toUpperCase()

  // Count existing products in the same category/subcategory to make unique
  const { data, error } = await supabase
    .from('products')
    .select('sku')
    .like('sku', `${categoryCode}-${subcategoryCode}-%`) // matches category/subcategory
    .order('sku', { ascending: false })
    .limit(1)

  if (error) throw new Error('Failed to generate SKU')

  let sequence = 1
  if (data && data.length > 0) {
    const lastSKU = data[0].sku
    const parts = lastSKU.split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    sequence = lastSeq + 1
  }

  const sequenceStr = sequence.toString().padStart(3, '0')

  // Final SKU format: CAT-SUB-PRO-UN-SEQ
  return `${categoryCode}-${subcategoryCode}-${nameCode}-${unitCode}-${sequenceStr}`
}
