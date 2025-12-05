# Consignment System - Complete Guide

## Overview

The **Consignment System** is now properly implemented as a monthly-based inventory tracking system where products are given to customers on consignment, with full tracking of balances, sales, and returns.

## How It Works in POS

### 1. **Initial Consignment (Month 1)**

When you create a consignment for a customer:
- Select the customer, month, and year
- Add products from your inventory to consign
- Products are **moved from regular inventory to consigned inventory**
- The system tracks:
  - **New Items**: Products added this month
  - **Current Balance**: Total items with the customer

**Example:**
```
January 2025: Consign 10 boxes of Medicine A
- Previous Balance: 0
- New Items: +10
- Current Balance: 10
```

### 2. **Recording Sales**

During the month, when the customer sells products:
- Open the consignment management modal
- Go to "Record Sale" tab
- Enter quantities sold by the customer
- System will:
  - Deduct from consigned inventory
  - Create a transaction record
  - Update balance due (amount customer owes you)

**Example:**
```
Customer reports: Sold 6 boxes
- Current Balance: 10
- Sold: -6
- New Current Balance: 4
- Balance Due: ₱6,000 (if ₱1,000 per box)
```

### 3. **Monthly Rollover (Next Month)**

When you create next month's consignment:
- System **automatically includes previous month's balance**
- You can add more products if needed
- Previous balance is clearly shown

**Example:**
```
February 2025: Add 8 more boxes
- Previous Balance: 4 (from January)
- New Items: +8
- Current Balance: 12
```

### 4. **Returning Items**

If customer returns unsold items:
- Open consignment management modal
- Go to "Return Items" tab
- Enter quantities to return
- System will:
  - Move items back to regular inventory
  - Deduct from consigned quantity
  - Update current balance

**Example:**
```
Customer returns 2 boxes
- Current Balance: 12
- Returned: -2
- New Current Balance: 10
```

## Complete Monthly Cycle Example

### Month 1: January 2025
```
Create Consignment:
- Customer: ABC Pharmacy
- Products: 10 boxes Medicine A @ ₱1,000 each
- Status:
  ├─ Previous Balance: 0
  ├─ New Items: +10
  ├─ Sold: 0
  ├─ Current Balance: 10
  └─ Balance Due: ₱0

After Customer Sells 6 boxes:
- Record Sale: 6 boxes
- Status:
  ├─ Previous Balance: 0
  ├─ New Items: +10
  ├─ Sold: -6
  ├─ Current Balance: 4
  └─ Balance Due: ₱6,000
```

### Month 2: February 2025
```
Create New Consignment:
- Automatic Previous Balance: 4 boxes (from January)
- Add New Items: 8 boxes
- Status:
  ├─ Previous Balance: 4
  ├─ New Items: +8
  ├─ Sold: 0
  ├─ Current Balance: 12
  └─ Balance Due: ₱0 (new month, previous balance due tracked separately)

After Customer Sells 7 boxes:
- Record Sale: 7 boxes
- Status:
  ├─ Previous Balance: 4
  ├─ New Items: +8
  ├─ Sold: -7
  ├─ Current Balance: 5
  └─ Balance Due: ₱7,000
```

### Month 3: March 2025
```
Create New Consignment:
- Automatic Previous Balance: 5 boxes (from February)
- Customer Returns: 2 boxes
- Add New Items: 5 boxes
- Status:
  ├─ Previous Balance: 5
  ├─ New Items: +5
  ├─ Sold: 0
  ├─ Returned: -2
  ├─ Current Balance: 8
  └─ Balance Due: ₱0
```

## Inventory Management

### Stock Movement Flow

```
┌─────────────────────────────────────────────────────────┐
│                   REGULAR INVENTORY                      │
│                     Stock: 100                           │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Consign 10 items
                  ▼
┌─────────────────────────────────────────────────────────┐
│               CONSIGNED INVENTORY                        │
│                 Consigned: 10                            │
│           (With ABC Pharmacy - Jan 2025)                 │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ├─► Customer Sells 6 ─► Deducted from Consigned
                  │                        Transaction Created
                  │                        Balance Due Updated
                  │
                  └─► Customer Returns 2 ─► Back to Regular Inventory
```

### Database Tracking

The system maintains 3 key tables:

1. **consignments** - Main monthly records
   - Customer information
   - Period (month/year)
   - Quantity balances (previous, new, sold, returned, current)
   - Financial totals

2. **consignment_items** - Individual products
   - Product details
   - Batch information (FIFO)
   - Quantity breakdown per item
   - Pricing

3. **consignment_history** - Activity log
   - All actions (created, items_added, sale_recorded, items_returned)
   - Audit trail

## Key Features

### ✅ Monthly Tracking
- Each consignment is tied to a specific month and year
- Clear separation between different periods
- Easy to track performance over time

### ✅ Balance History
- **Previous Balance**: Items carried over from last month
- **New Items**: Freshly consigned this month
- **Sold**: Items sold by customer
- **Returned**: Items returned to inventory
- **Current Balance**: Items still with customer

### ✅ Financial Tracking
- Total consigned value
- Total sold value
- Balance due (what customer owes)
- Payment tracking per transaction

### ✅ Inventory Accuracy
- FIFO (First In, First Out) batch tracking
- Real-time stock updates
- No race conditions (atomic operations)
- Expiration date awareness

### ✅ Easy Management
- One-click access to consignment details
- Intuitive tabs for different actions
- Quick sale recording
- Simple return process

## User Interface

### Consignment List
Shows all consignments with:
- Consignment number
- Customer name
- Period (e.g., "January 2025")
- Previous balance, new items, sold, current balance
- Balance due
- Status (active, settled, closed)
- Manage button

### Create Consignment
- Customer selection
- Month and year selection
- Previous balance indicator (auto-loaded)
- Product selection with quantity and price
- Summary showing total items and value

### Manage Consignment Modal

**Overview Tab:**
- Complete item breakdown
- All quantities (previous, added, sold, returned, current)
- Pricing and totals

**Record Sale Tab:**
- Select quantities sold per product
- Automatic subtotal calculation
- Creates transaction record
- Updates balance due

**Return Items Tab:**
- Select quantities to return per product
- Returns items to regular inventory
- Updates consigned quantities

## Best Practices

### 1. **Create Monthly Consignments**
- Create new consignment at the start of each month
- Review previous month's balance before adding new items
- System automatically carries forward unsold items

### 2. **Regular Sale Recording**
- Record sales as customer reports them (weekly or bi-weekly)
- Don't wait until end of month
- Keeps inventory accurate

### 3. **Handle Returns Promptly**
- Process returns as they happen
- Check product condition before accepting
- Updates inventory immediately

### 4. **Monitor Balances**
- Review current balance regularly
- Follow up on slow-moving items
- Adjust future consignments based on sales velocity

### 5. **Financial Reconciliation**
- Track balance due
- Record payments (can be done separately in transactions)
- Reconcile at end of each month

## Technical Implementation

### Database Functions

1. **create_consignment()** - Creates new monthly consignment
   - Validates inventory
   - Deducts from regular stock
   - Adds to consigned stock
   - Carries forward previous balance
   - FIFO batch tracking

2. **record_consignment_sale()** - Records customer sales
   - Creates transaction record
   - Deducts from consigned stock
   - Updates balance due
   - Links to consignment

3. **return_consignment_items()** - Returns items to inventory
   - Returns to regular stock
   - Deducts from consigned stock
   - Updates consignment balance

### Atomic Operations
All operations use PostgreSQL transactions with row-level locking (FOR UPDATE) to prevent:
- Race conditions
- Stock inconsistencies
- Duplicate consignments
- Data corruption

## Migration from Old System

If you have existing consignment transactions in the old format:
1. Old transactions remain in `transactions` table
2. New consignments use proper `consignments` table
3. Two systems can coexist temporarily
4. Recommend migrating to new system for all new consignments

## Troubleshooting

### Issue: "Insufficient stock" error
**Solution:** Check regular inventory. Items must be in stock before consigning.

### Issue: Previous balance not showing
**Solution:** 
- Verify previous month's consignment exists
- Check status is "active"
- Ensure same customer and branch

### Issue: Can't record sale
**Solution:** 
- Check current balance has enough items
- Verify quantities don't exceed available
- Check consignment is active

### Issue: Return not working
**Solution:**
- Verify product_stock_id exists
- Check item is still in consignment
- Ensure quantity doesn't exceed current balance

## Summary

The new Consignment System provides:
- ✅ Proper monthly tracking
- ✅ Clear balance history
- ✅ Accurate inventory management
- ✅ Financial tracking
- ✅ Easy-to-use interface
- ✅ Audit trail
- ✅ Data integrity

It follows standard POS consignment practices and ensures your inventory stays accurate while tracking what customers owe you.
