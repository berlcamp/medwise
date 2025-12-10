import { RootState as RootStateType } from '@/lib/redux'

export type RootState = RootStateType

export interface Settings {
  id: string
  shipping_company: string
  shipping_address: string
  shipping_contact_number: string
  billing_company: string
  billing_address: string
  billing_contact_number: string
}

export interface User {
  id: string
  user_id: string
  org_id: string
  name: string
  password: string
  email?: string
  position?: string
  branch_id: number
  type?: string
  is_active: boolean
  created_at?: string
  branch: Branch
}

export interface AddUserFormValues {
  name: string
  email: string
  type: string
  is_active: boolean
}

export interface Resident {
  id: number
  fullname: string
  location_id: number
  type: string
  location?: Location
  resident_remarks?: ResidentRemarks[]
}

export interface Location {
  id: number
  name?: string
  address?: string
  description?: string
  org_id?: string
  color: string
  purok?: string[]
}
export interface LocationUser {
  id: number
  user_id: number
  location_id: number
  org_id: string
  is_editor: boolean
  is_importer: boolean
  user: User
}

export interface Voter {
  id: number
  location_id: number
  fullname: string
  address: string
  precinct: string
  barangay: string
  birthday: string
  category: string
  voter_remarks: VoterRemarks[]
}

export interface Member {
  id: number
  fullname: string
  lastname: string
  firstname: string
  middlename: string
  barangay: string
  birthday: string
  municipality: string
  member_remarks: MemberRemarks[]
}

export interface ResidentRemarks {
  id: number
  created_at: string
  resident_id: number
  content: string
  author: string
}
export interface VoterRemarks {
  id: number
  created_at: string
  voter_id: number
  voter: Voter
  author: string
  status: 'Pending Approval' | 'Approved'
  user_id: string
  remarks: string
}
export interface MemberRemarks {
  id: number
  created_at: string
  voter_id: number
  voter: Voter
  member: Member
  author: string
  status: 'Pending Approval' | 'Approved'
  user_id: string
  remarks: string
  details: {
    id: number
    fullname: string
    firstname: string
    middlename: string
    lastname: string
    barangay: string
    municipality: string
    birthday: string
  }
}

export interface HouseholdRemarks {
  id: number
  created_at: string
  household_id: number
  content: string
  author: string
}

// Household record (asenso.households)
export interface Household {
  id: number
  name: string
  purok: string
  sitio: string
  barangay?: string | null
  address?: string | null
  location_id?: number | null
  org_id?: number | null
  created_at?: string

  // Relations
  families?: Family[]
}

export interface VoterLite {
  id: number
  voter_id: number
  fullname: string
  is_registered: boolean
  relation: string
}

// Family record (asenso.families)
export interface Family {
  id: number
  household_id: number
  husband_id?: number | null
  wife_id?: number | null
  created_at?: string
  wife_name: string
  husband_name: string
  all_nr?: boolean

  // Relations
  husband?: VoterLite | null
  wife?: VoterLite | null
  family_members?: FamilyMember[]
  allowNonRegistered?: boolean
}

// Family member record (asenso.family_members)
export interface FamilyMember {
  id?: number
  family_id?: number
  voter_id?: number | null
  fullname: string
  relation: string
  is_registered: boolean
  created_at?: string

  // Relations
  voter?: Voter | null
}

// =============================================================
// POS SYSTEM TYPES
// =============================================================

// ===============================
// BRANCHES
// ===============================
export interface Branch {
  id: number
  name: string
  org_id: number
  address: string
  contact_number: string
  created_at: string
}
export interface Supplier {
  id: number
  name: string
  org_id: number
  address: string
  contact_number: string
  created_at: string
}

// ===============================
// STAFF
// ===============================
export interface Staff {
  id: number
  user_id: number
  branch_id?: number | null
  position?: string | null
  rate?: number | null
  created_at: string
  user?: User
  branch?: Branch
}

// ===============================
// PRODUCTS
// ===============================
export interface Product {
  id: number
  branch_id?: number | null
  name: string
  sku: string
  description?: string
  category?: string
  selling_price: number
  cost: number
  type: 'for sale' | 'internal'
  stock_qty?: number
  unit?: string
  is_active: boolean
  created_at: string
  branch?: Branch
  reorder_point: number
  generic_name: string
  brand_name: string
  fda_reg_no: string
  dosage: string
  subcategory: string
  prescription_log_book: boolean
  gl_percent: number
}

// ===============================
// PRODUCT Stock
// ===============================
export interface ProductStock {
  id: number
  product_id: number
  supplier_id: number
  branch_id: number
  product?: Product
  supplier?: Supplier
  type: string
  inventory_type: string
  quantity: number
  reorder_point: number
  remaining_quantity: number
  consigned_quantity: number
  remarks: string
  created_at: string
  purchase_price: number
  batch_no: string
  manufacturer: string
  date_manufactured: string
  transaction_date: string
  expiration_date: string
}

// ===============================
// SERVICES
// ===============================
export interface Service {
  id: number
  branch_id?: number | null
  category_id: number
  name: string
  description?: string | null
  base_price: number
  duration_minutes?: number | null
  is_active: boolean
  created_at: string
  branch?: Branch
  category?: ServiceCategory
}
export interface ServiceCategory {
  id: number
  name: string
  parent_id: number
}

// ===============================
// CUSTOMERS
// ===============================
export interface Customer {
  id: number
  name: string
  birthday?: string
  contact_number?: string
  email?: string
  address?: string
  tin?: string
  created_at: string
}

export type Booking = {
  id: number
  customer_id?: number
  user_id?: number
  branch_id: number
  doctor_id: number
  schedule_date: string
  created_by: string
  time_start: string
  status?: 'scheduled' | 're-scheduled' | 'done' | 'completed' | 'canceled'
  notes?: string
  remarks: string
  org_id: string
  customer?: Customer
  branch?: Branch
  attendants?: string[]
  procedures?: Service[]
  services?: BookingService[]
  doctor?: User
}

export type BookingAttendant = {
  id: number
  booking_id: number
  user_id: number
}

export interface BookingService {
  id: number
  booking_id: number
  service_id: number
  service?: Service
}

// types/Transaction.ts

export interface Transaction {
  id: number
  org_id: number
  reference_number: string
  payment_status: string
  delivery_status: string
  transaction_type: string
  partial_amount: string
  transaction_number: string
  gl_number: string
  payment_type: string
  customer_name?: string | null
  total_amount: number
  status: 'completed' | 'pending' | 'returned' | string // extendable for future statuses
  branch_id?: number | null
  customer_id?: number | null
  customer?: Customer
  transaction_items: TransactionItem[]
  created_at: string
}

export interface TransactionItem {
  id: number
  transaction_id: number | null
  item_type: 'product' | 'service' | string
  product_id: number | null
  product?: Product
  service_id: number | null
  unit: string | null
  quantity: number
  price: number
  total: number
  batch_no: string
  date_manufactured: string
  expiration_date: string
  created_at: string
  products?: {
    id: number
    name: string
  } | null
  services?: {
    id: number
    name: string
  } | null
}

export interface TransactionWithItems extends Transaction {
  transaction_items: TransactionItem[]
}

// ===============================
// CONSIGNMENT SYSTEM
// ===============================
export interface Consignment {
  id: number
  org_id: number
  branch_id: number
  customer_id: number
  customer_name: string
  consignment_number: string
  
  // Monthly tracking
  month: number // 1-12
  year: number
  
  // Status
  status: 'active' | 'settled' | 'closed'
  
  // Balances
  previous_balance_qty: number // Items from last month
  new_items_qty: number        // New items this month
  sold_qty: number             // Items sold this month
  returned_qty: number         // Items returned to inventory
  current_balance_qty: number  // Items still with customer
  
  // Financial
  total_consigned_value: number
  total_sold_value: number
  total_paid: number
  balance_due: number
  
  // Metadata
  notes?: string
  created_at: string
  updated_at: string
  created_by?: string
  
  // Relations
  customer?: Customer
  branch?: Branch
  consignment_items?: ConsignmentItem[]
}

export interface ConsignmentItem {
  id: number
  consignment_id: number
  product_id: number
  product_stock_id?: number
  
  // Batch info
  batch_no?: string
  date_manufactured?: string
  expiration_date?: string
  
  // Quantities
  previous_balance: number     // From last month
  quantity_added: number       // New items this entry
  quantity_sold: number        // Sold this month
  quantity_returned: number    // Returned to inventory
  current_balance: number      // Still with customer
  
  // Pricing
  unit_price: number
  total_value: number
  
  // Transaction tracking
  transaction_id?: number
  
  created_at: string
  updated_at: string
  
  // Relations
  product?: Product
  transaction?: Transaction
}

export interface ConsignmentHistory {
  id: number
  consignment_id: number
  action_type: 'created' | 'items_added' | 'sale_recorded' | 'items_returned' | 'settled' | 'closed'
  
  product_id?: number
  quantity?: number
  amount?: number
  
  notes?: string
  created_at: string
  created_by?: string
  
  // Relations
  product?: Product
}

// ===============================
// QUOTATION SYSTEM
// ===============================
export interface Quotation {
  id: number
  org_id: number
  branch_id: number
  customer_id?: number
  customer_name: string
  quotation_number: string
  quotation_date: string
  valid_until?: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  total_amount: number
  notes?: string
  created_at: string
  updated_at: string
  created_by?: string
  
  // Relations
  customer?: Customer
  branch?: Branch
  quotation_items?: QuotationItem[]
}

export interface QuotationItem {
  id: number
  quotation_id: number
  product_id: number
  quantity: number
  unit_price: number
  total: number
  notes?: string
  created_at: string
  
  // Relations
  product?: Product
}

// ===============================
// AGENT SYSTEM
// ===============================
export interface Agent {
  id: number
  org_id: number
  branch_id: number
  name: string
  area?: string
  contact_number?: string
  vehicle_plate_number?: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  created_by?: string
  
  // Relations
  branch?: Branch
  agent_items?: AgentItem[]
}

export interface AgentItem {
  id: number
  agent_id: number
  product_id: number
  product_stock_id?: number
  batch_no?: string
  expiration_date?: string
  quantity_added: number
  quantity_sold: number
  quantity_returned: number
  current_balance: number
  unit_price: number
  total_value: number
  transaction_id?: number
  created_at: string
  updated_at: string
  
  // Relations
  product?: Product
}

export interface AgentHistory {
  id: number
  agent_id: number
  action_type: 'created' | 'items_added' | 'sale_recorded' | 'items_returned'
  
  product_id?: number
  quantity?: number
  amount?: number
  
  notes?: string
  created_at: string
  created_by?: string
  
  // Relations
  product?: Product
}
