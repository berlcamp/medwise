# Consignment System - Migration & Setup Steps

## Step 1: Run Database Migration

You need to run the new database migration to create the consignment tables and functions.

### Option A: Using Supabase CLI (Recommended)

```bash
# Navigate to your project directory
cd /Users/berltreasurecampomanes/Documents/Github\ Builds/medwise2

# Run the migration
supabase db push

# Or if you have Supabase CLI connected
supabase migration up
```

### Option B: Manual SQL Execution

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of:
   ```
   supabase/migrations/002_create_consignment_system.sql
   ```
4. Click **Run**

This will create:
- `consignments` table
- `consignment_items` table
- `consignment_history` table
- All necessary indexes
- Database functions (create_consignment, record_consignment_sale, return_consignment_items)

## Step 2: Verify Table Creation

Run this query in Supabase SQL Editor to verify tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'medwise' 
  AND table_name IN ('consignments', 'consignment_items', 'consignment_history');
```

You should see 3 tables listed.

## Step 3: Test Database Functions

Test if the functions were created successfully:

```sql
-- Test generate_consignment_number
SELECT medwise.generate_consignment_number();

-- Should return something like: CONS-202412-0001
```

## Step 4: Update Environment (if needed)

Make sure your `.env.local` file has:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_ORG_ID=your_org_id
```

## Step 5: Install Dependencies (if needed)

The new system uses existing dependencies, but make sure you have:

```bash
npm install
# or
yarn install
```

## Step 6: Restart Development Server

```bash
npm run dev
# or
yarn dev
```

## Step 7: Test the System

### Test 1: Create a Consignment

1. Navigate to **Consignments** page
2. Click **+ New Consignment**
3. Select a customer
4. Select current month and year
5. Add products
6. Click **Create Consignment**

**Expected Result:**
- Consignment created successfully
- Products moved to consigned inventory
- Redirects to consignments list

### Test 2: View Consignment Details

1. In consignments list, click **Manage** on a consignment
2. Verify all tabs work:
   - **Overview**: Shows item breakdown
   - **Record Sale**: Input fields work
   - **Return Items**: Input fields work

### Test 3: Record a Sale

1. Open a consignment management modal
2. Go to **Record Sale** tab
3. Enter quantities sold
4. Click **Record Sale**
5. Confirm the action

**Expected Result:**
- Sale recorded successfully
- Current balance updated
- Balance due increased
- Transaction created in system

### Test 4: Return Items

1. Open a consignment management modal
2. Go to **Return Items** tab
3. Enter quantities to return
4. Click **Return Items**
5. Confirm the action

**Expected Result:**
- Items returned successfully
- Current balance updated
- Inventory increased

### Test 5: Monthly Rollover

1. Create a consignment for Customer A in Month 1
2. Record some sales (leave balance)
3. Create a new consignment for Customer A in Month 2

**Expected Result:**
- Previous balance automatically loaded
- Shows items from previous month
- Can add new items
- Total balance calculated correctly

## Step 8: Data Migration (Optional)

If you have existing consignment data in the old `transactions` table:

### Option A: Keep Old Data As-Is
- Old consignments remain in `transactions` table
- Use new system for all new consignments going forward
- Eventually old data becomes historical

### Option B: Migrate Old Data (Manual)
For each old consignment transaction:

```sql
-- Example migration for one transaction
-- You'll need to adapt this for your data

INSERT INTO medwise.consignments (
  org_id,
  branch_id,
  customer_id,
  customer_name,
  consignment_number,
  month,
  year,
  status,
  previous_balance_qty,
  new_items_qty,
  current_balance_qty,
  total_consigned_value,
  created_at
)
SELECT 
  org_id,
  branch_id,
  customer_id,
  customer_name,
  transaction_number,
  EXTRACT(MONTH FROM created_at)::INTEGER,
  EXTRACT(YEAR FROM created_at)::INTEGER,
  'active',
  0,
  -- Calculate total quantity from transaction_items
  (SELECT SUM(quantity) FROM medwise.transaction_items WHERE transaction_id = t.id),
  (SELECT SUM(quantity) FROM medwise.transaction_items WHERE transaction_id = t.id),
  total_amount,
  created_at
FROM medwise.transactions t
WHERE transaction_type = 'consignment'
  AND id = YOUR_TRANSACTION_ID;

-- Then insert items...
```

**Note:** This is complex and may require custom migration script based on your data.

## Troubleshooting

### Error: "relation does not exist"
**Cause:** Migration not run yet
**Solution:** Run Step 1 again

### Error: "function does not exist"
**Cause:** Database functions not created
**Solution:** 
1. Check if migration ran successfully
2. Verify functions exist:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'medwise' 
     AND routine_name LIKE '%consignment%';
   ```

### Error: "Insufficient stock"
**Cause:** Not enough inventory
**Solution:** Add stock first in Products > Stocks before creating consignment

### Error: "Permission denied"
**Cause:** Database permissions not granted
**Solution:** Re-run the migration which includes GRANT statements

### Error: Previous balance not loading
**Cause:** No previous month consignment found
**Solution:** This is normal for first-time consignments or if previous month doesn't exist

## Verification Checklist

- [ ] Database migration completed
- [ ] Tables created (consignments, consignment_items, consignment_history)
- [ ] Functions created (create_consignment, record_consignment_sale, return_consignment_items)
- [ ] Development server restarted
- [ ] Can access /consignments page
- [ ] Can access /consignment (create) page
- [ ] Can create a new consignment
- [ ] Can view consignment details
- [ ] Can record sales
- [ ] Can return items
- [ ] Can create next month's consignment with previous balance

## Support

If you encounter issues:

1. Check the browser console for errors
2. Check the Supabase logs in Dashboard
3. Verify database connection
4. Check that user has proper permissions
5. Review the CONSIGNMENT_SYSTEM_GUIDE.md for usage help

## Next Steps After Setup

1. Create test consignment to familiarize yourself
2. Train staff on new workflow
3. Set up monthly schedule for creating new consignments
4. Establish process for recording sales regularly
5. Create payment reconciliation workflow
6. Monitor inventory levels

## Rollback (If Needed)

If you need to rollback the migration:

```sql
-- Drop tables (be careful, this deletes data!)
DROP TABLE IF EXISTS medwise.consignment_history CASCADE;
DROP TABLE IF EXISTS medwise.consignment_items CASCADE;
DROP TABLE IF EXISTS medwise.consignments CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS medwise.create_consignment CASCADE;
DROP FUNCTION IF EXISTS medwise.record_consignment_sale CASCADE;
DROP FUNCTION IF EXISTS medwise.return_consignment_items CASCADE;
DROP FUNCTION IF EXISTS medwise.generate_consignment_number CASCADE;
```

**Warning:** Only do this if absolutely necessary and you have backups!
