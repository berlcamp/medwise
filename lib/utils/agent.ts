import { supabase } from '@/lib/supabase/client'

export interface CreateAgentAssignmentParams {
  org_id: number
  branch_id: number
  agent_id: number
  items: Array<{
    product_id: number
    quantity: number
    price: number
  }>
  created_by: string
}

export interface RecordAgentSaleParams {
  agent_id: number
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

export interface ReturnAgentItemsParams {
  agent_id: number
  items: Array<{
    product_id: number
    product_stock_id: number
    quantity: number
  }>
  created_by: string
}

/**
 * Create agent assignment (give items to agent)
 */
export async function createAgentAssignment(
  params: CreateAgentAssignmentParams
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('create_agent_assignment', {
      p_org_id: params.org_id,
      p_branch_id: params.branch_id,
      p_agent_id: params.agent_id,
      p_items: params.items,
      p_created_by: params.created_by
    })

    if (error) {
      console.error('Create assignment error:', error)
      return {
        success: false,
        error: error.message,
        message: 'Failed to create assignment'
      }
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data
    return result
  } catch (err: unknown) {
    console.error('Create assignment exception:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      message: 'Failed to create assignment'
    }
  }
}

/**
 * Record a sale from agent items
 */
export async function recordAgentSale(
  params: RecordAgentSaleParams
): Promise<{
  success: boolean
  transaction_id?: number
  transaction_number?: string
  message?: string
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('record_agent_sale', {
      p_agent_id: params.agent_id,
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
  } catch (err: unknown) {
    console.error('Record sale exception:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      message: 'Failed to record sale'
    }
  }
}

/**
 * Return items from agent back to inventory
 */
export async function returnAgentItems(
  params: ReturnAgentItemsParams
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('return_agent_items', {
      p_agent_id: params.agent_id,
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
  } catch (err: unknown) {
    console.error('Return items exception:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      message: 'Failed to return items'
    }
  }
}

/**
 * Generate transaction number for agent sales
 */
export async function generateTransactionNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const { data, error } = await supabase
    .from('transactions')
    .select('transaction_number')
    .like('transaction_number', `AGENT-${year}-%`)
    .order('transaction_number', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error generating transaction number:', error)
    return `AGENT-${year}-000001`
  }

  let sequence = 1
  if (data && data.length > 0) {
    const lastNumber = data[0].transaction_number
    const parts = lastNumber.split('-')
    if (parts.length === 3) {
      sequence = parseInt(parts[2], 10) + 1
    }
  }

  return `AGENT-${year}-${sequence.toString().padStart(6, '0')}`
}
