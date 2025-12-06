/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase/client'

export interface CreateConsignmentParams {
  org_id: number
  branch_id: number
  customer_id: number
  customer_name: string
  month: number
  year: number
  items: Array<{
    product_id: number
    quantity: number
    price: number
  }>
  created_by: string
}

export interface RecordSaleParams {
  consignment_id: number
  items: Array<{
    product_id: number
    quantity: number
    price: number
  }>
  transaction_number: string
  payment_type: string
  payment_status: string
  created_by: string
}

export interface ReturnItemsParams {
  consignment_id: number
  items: Array<{
    product_id: number
    product_stock_id: number
    quantity: number
  }>
  created_by: string
}

export interface AddConsignmentItemsParams {
  consignment_id: number
  items: Array<{
    product_id: number
    quantity: number
    price: number
  }>
  created_by: string
}

/**
 * Create a new consignment with monthly tracking
 */
export async function createConsignment(params: CreateConsignmentParams): Promise<{
  success: boolean
  consignment_id?: number
  consignment_number?: string
  message?: string
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('create_consignment', {
      p_org_id: params.org_id,
      p_branch_id: params.branch_id,
      p_customer_id: params.customer_id,
      p_customer_name: params.customer_name,
      p_month: params.month,
      p_year: params.year,
      p_items: params.items,
      p_created_by: params.created_by
    })

    if (error) {
      console.error('Consignment creation error:', error)
      return {
        success: false,
        error: error.message,
        message: 'Failed to create consignment'
      }
    }

    // Parse the JSON response from the function
    const result = typeof data === 'string' ? JSON.parse(data) : data
    return result
  } catch (err: any) {
    console.error('Consignment creation exception:', err)
    return {
      success: false,
      error: err.message,
      message: 'Failed to create consignment'
    }
  }
}

/**
 * Record a sale from consignment items
 */
export async function recordConsignmentSale(params: RecordSaleParams): Promise<{
  success: boolean
  transaction_id?: number
  transaction_number?: string
  message?: string
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('record_consignment_sale', {
      p_consignment_id: params.consignment_id,
      p_items: params.items,
      p_transaction_number: params.transaction_number,
      p_payment_type: params.payment_type,
      p_payment_status: params.payment_status,
      p_created_by: params.created_by
    })

    if (error) {
      console.error('Record sale error:', error)
      return {
        success: false,
        error: error.message,
        message: 'Failed to record sale'
      }
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data
    return result
  } catch (err: any) {
    console.error('Record sale exception:', err)
    return {
      success: false,
      error: err.message,
      message: 'Failed to record sale'
    }
  }
}

/**
 * Return items from consignment back to inventory
 */
export async function returnConsignmentItems(params: ReturnItemsParams): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('return_consignment_items', {
      p_consignment_id: params.consignment_id,
      p_items: params.items,
      p_created_by: params.created_by
    })

    if (error) {
      console.error('Return items error:', error)
      return {
        success: false,
        error: error.message,
        message: 'Failed to return items'
      }
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data
    return result
  } catch (err: any) {
    console.error('Return items exception:', err)
    return {
      success: false,
      error: err.message,
      message: 'Failed to return items'
    }
  }
}

/**
 * Add items to an existing consignment
 * This allows adding new products or increasing quantities of existing products
 */
export async function addConsignmentItems(params: AddConsignmentItemsParams): Promise<{
  success: boolean
  message?: string
  items_added?: number
  total_value?: number
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('add_consignment_items', {
      p_consignment_id: params.consignment_id,
      p_items: params.items,
      p_created_by: params.created_by
    })

    if (error) {
      console.error('Add items error:', error)
      return {
        success: false,
        error: error.message,
        message: 'Failed to add items'
      }
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data
    return result
  } catch (err: any) {
    console.error('Add items exception:', err)
    return {
      success: false,
      error: err.message,
      message: 'Failed to add items'
    }
  }
}

/**
 * Generate next transaction number for consignment sale
 */
export async function generateTransactionNumber(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('generate_transaction_number')
    
    if (error) {
      console.error('Generate transaction number error:', error)
      // Fallback to client-side generation
      return `TXN-${Date.now()}`
    }
    
    return data || `TXN-${Date.now()}`
  } catch (err) {
    console.error('Generate transaction number exception:', err)
    return `TXN-${Date.now()}`
  }
}

/**
 * Get month name from month number
 */
export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[month - 1] || ''
}

/**
 * Get current month and year
 */
export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date()
  return {
    month: now.getMonth() + 1, // JavaScript months are 0-indexed
    year: now.getFullYear()
  }
}

/**
 * Format consignment period (e.g., "January 2025")
 */
export function formatConsignmentPeriod(month: number, year: number): string {
  return `${getMonthName(month)} ${year}`
}
