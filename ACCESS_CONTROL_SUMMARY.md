# Access Control Summary

This document outlines the access control implementation for different user types in the Medwise application.

## User Types and Access Levels

### 1. Cashier Users
**Can only access:**
- Home page (`/home`)
- Retail Transactions List (`/transactions`)
- Retail Transaction Form (`/transaction`)

**Restricted from:**
- Dashboard
- Bulk Transactions
- Consignments
- Customers
- Products
- Product Stocks
- Reports
- Staff
- Branches
- Suppliers
- All other pages

### 2. Bulk Users
**Can access everything except:**
- Sales-related items in Reports and Dashboard:
  - Sales Report tab
  - Daily Summary tab
  - Profit Report tab
  - Payment Methods tab
  - Customer Sales tab
  - Product Performance tab
  - Total Sales card
  - Average Transaction Value card
  - Products Sold metric
  - Products per Transaction metric
  - Sales Performance chart
  - Top Selling Products chart
- Branches CRUD operations

**Can access:**
- All other pages and features
- Inventory, Expiry, and Stock Movements reports
- All transaction types (retail, bulk, consignments)
- Products, Customers, Staff, Suppliers management

### 3. Admin Users
**Can access everything except:**
- Branches CRUD operations

**Can access:**
- All pages and features
- All reports including sales-related items
- All transaction types
- Products, Customers, Staff, Suppliers management
- Dashboard with full analytics

### 4. Super Admin Users
**Full access to everything:**
- All pages and features
- All reports and analytics
- All transaction types
- Complete CRUD operations on all entities including Branches
- Staff management
- System configuration

## Implementation Details

### Files Modified

#### 1. Sidebar Navigation (`components/AppSidebar.tsx`)
- **Cashier users**: Menu filtered to show only Home and Retail Transactions
- **Bulk/Admin users**: Branches menu item hidden from Settings section
- **Super Admin**: Full menu access

#### 2. Page Access Restrictions

**Dashboard** (`app/(auth)/dashboard/page.tsx`)
- Cashier: Blocked
- Bulk: Sales-related items hidden
- Admin/Super Admin: Full access

**Reports** (`app/(auth)/reports/page.tsx`)
- Cashier: Blocked
- Bulk: Sales/profit-related tabs hidden (Sales, Daily, Profit, Payment, Customer, Product)
- Admin/Super Admin: Full access

**Branches** (`app/(auth)/branches/page.tsx`)
- Cashier: Blocked
- Bulk: Blocked
- Admin: Blocked
- Super Admin: Full access

**Bulk Transactions** (`app/(auth)/bulktransactions/page.tsx`)
- Cashier: Blocked
- Others: Full access

**Consignments** (`app/(auth)/consignments/page.tsx`)
- Cashier: Blocked
- Others: Full access

**Customers** (`app/(auth)/customers/page.tsx`)
- Cashier: Blocked
- Others: Full access

**Products** (`app/(auth)/products/page.tsx`)
- Cashier: Blocked
- Others: Full access

**Product Stocks** (`app/(auth)/productstocks/page.tsx`)
- Cashier: Blocked
- Others: Full access

**Staff** (`app/(auth)/staff/page.tsx`)
- Cashier: Blocked
- User: Blocked
- Others: Full access

**Suppliers** (`app/(auth)/suppliers/page.tsx`)
- Cashier: Blocked
- User: Blocked
- Others: Full access

**Bulk Transaction Form** (`app/(auth)/bulktransaction/page.tsx`)
- Cashier: Blocked
- Others: Full access

**Consignment Form** (`app/(auth)/consignment/page.tsx`)
- Cashier: Blocked
- Others: Full access

## Access Control Pattern

All restricted pages follow this pattern:
```typescript
const user = useAppSelector((state) => state.user.user)

if (user?.type === 'cashier') return <Notfoundpage />
// or
if (user?.type === 'user' || user?.type === 'cashier') return <Notfoundpage />
// or
if (user?.type !== 'super admin') return <Notfoundpage />
```

## Notes

- Cashier users have the most restricted access, limited to retail transaction operations
- Bulk users can access most features but cannot view sales/profit analytics or manage branches
- Admin users have near-full access except for branch management
- Super Admin has complete system access
- All access restrictions are enforced both in the sidebar navigation and on individual pages

## Last Updated
December 2024
