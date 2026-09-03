# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start development server (localhost:3000)
- `npm run build` — Production build
- `npm run lint` — ESLint check (next/core-web-vitals + next/typescript)
- No test framework is configured

## Architecture

**MedWise** is a pharmaceutical point-of-sale system built with Next.js 15 (App Router), React 19, TypeScript, and Supabase (PostgreSQL).

### Routing & Auth

- **Route groups**: `app/(public)/` for unauthenticated pages (login, OAuth callback, legal pages), `app/(auth)/` for protected pages wrapped by `AuthGuard`
- **Authentication**: Google OAuth via Supabase Auth. OAuth callback at `app/(public)/auth/callback/`. User records live in a custom `users` table
- **Middleware**: `lib/supabase/middleware.ts` refreshes auth tokens on every request (no root `middleware.ts` — the function is called from Next.js middleware config)
- **User types** (role-based access): `cashier`, `bulk`, `admin`, `super_admin`, `agent` — checked via `user.type` in components and sidebar visibility
- **Agent layout**: Agents get a special layout with no sidebar — only their dedicated dashboard pages. Non-agent users get the full `AppSidebar` + `StickyHeader`

### Data Layer

- **No REST API layer** — components query Supabase directly using `@supabase/supabase-js`
- **Custom schema**: All Supabase clients use the `medwise` schema (configured in `lib/supabase/client.ts`, `lib/supabase/server.ts`, and `lib/supabase/middleware.ts`)
- **Critical operations use RPC functions** (e.g., `create_transaction_with_stock_deduction` uses `FOR UPDATE` row locking for atomic FIFO stock deduction). See `MIGRATION_GUIDE.md` for why this pattern replaced client-side stock logic
- **Migrations** are in `supabase/migrations/` numbered sequentially (001–013)
- **All types** are defined in `types/index.ts` — Transaction, Product, ProductStock, Customer, Consignment, Agent, Quotation, etc.

### State Management

- **Redux Toolkit** with slices in `lib/redux/` — user, branch, locations, stocks, households, list
- Typed hooks: `useAppSelector` / `useAppDispatch` from `lib/redux/hook.ts`
- Redux Provider wraps the `(auth)` layout

### UI Stack

- **Shadcn/ui** (new-york style) with components in `components/ui/` — add new ones via `npx shadcn@latest add <component>`
- **Tailwind CSS 4** with CSS variables for theming (dark mode supported)
- **Lucide React** for icons
- **React Hook Form + Zod** for form validation
- **react-hot-toast** for notifications
- **Recharts** for dashboard analytics charts
- Path alias: `@/` maps to project root

### Key Modules

- `lib/utils/transaction.ts` — Transaction creation with stock deduction logic (calls RPC)
- `lib/utils/consignment.ts` — Consignment CRUD and sales recording (calls RPC)
- `lib/utils/agent.ts` — Agent-related operations
- `lib/constants/index.ts` — Billing agencies, product categories, units of measure, `PER_PAGE = 20`
- `components/TransactionForm.tsx` — Main POS transaction form (large, complex component ~975 lines)
- `components/printables/` — PDF generators (Invoice, Consignment, Quotation, DeliveryReceipt, PaymentHistory) using jsPDF
- `components/reports/` — Report components (DailySales, SalesReport, Inventory, ProfitReport, ExpiryReport, etc.)

### Multi-tenancy

- Organization-scoped via `org_id` field
- Branch-based data isolation — transactions, reports, and inventory are branch-specific
- Branch switcher in `components/BranchSwitcher.tsx`

### File Generation

- PDF generation: `jsPDF` + `jspdf-autotable`
- Excel export: `XLSX` (SheetJS)
- CSV parsing: `PapaParse`

### Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key

### Reference Documentation

- `CONSIGNMENT_SYSTEM_GUIDE.md` — How the monthly consignment tracking works
- `MIGRATION_GUIDE.md` — Stock deduction race condition fix and RPC migration details
- `ACCESS_CONTROL_SUMMARY.md` — Role-based access control overview
