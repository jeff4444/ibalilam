# Security Vulnerability Report
## Techafon E-Commerce Platform

**Report Date:** January 2026  
**Classification:** CONFIDENTIAL - Internal Use Only  
**Scope:** Application Layer, Database Layer, Environment Configuration

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Vulnerabilities](#critical-vulnerabilities)
3. [High Severity Vulnerabilities](#high-severity-vulnerabilities)
4. [Medium Severity Vulnerabilities](#medium-severity-vulnerabilities)
5. [Low Severity Vulnerabilities](#low-severity-vulnerabilities)
6. [Informational Findings](#informational-findings)

---

## Executive Summary

This report documents **27 security vulnerabilities** identified across the Techafon e-commerce platform:

| Severity | Count | Immediate Action Required |
|----------|-------|---------------------------|
| 🔴 Critical | 8 | Yes - Before Production |
| 🟠 High | 7 | Yes - Within 48 Hours |
| 🟡 Medium | 8 | Recommended - Within 1 Week |
| 🟢 Low | 4 | Advisory |

The most severe vulnerabilities relate to **price manipulation**, **payment processing**, and **database access controls** that could result in direct financial loss.

---

## Critical Vulnerabilities

### VULN-001: Client-Side Price Manipulation in Order Creation [RESOVED]

**Location:** `app/api/orders/create/route.ts`

**Description:**  
The order creation endpoint accepts pricing data (`totalAmount`, `subtotal`, `tierPrice`, `shippingAmount`, `taxAmount`, `discountAmount`) directly from the client request body without server-side validation against database values.

**Vulnerable Code:**
```typescript
const {
  items,
  shippingAddress,
  customerEmail,
  customerName,
  subtotal,           // Client-controlled
  shippingAmount,     // Client-controlled
  taxAmount,          // Client-controlled
  discountAmount,     // Client-controlled
  totalAmount,        // Client-controlled
} = body
```

**Attack Vector:**  
An attacker can intercept the checkout request using browser developer tools or a proxy (Burp Suite, mitmproxy) and modify the JSON payload:

```json
{
  "items": [{"part_id": "uuid-here", "quantity": 10, "tierPrice": 0.01}],
  "totalAmount": 0.10,
  "subtotal": 0.10,
  "taxAmount": 0,
  "shippingAmount": 0,
  "discountAmount": 0
}
```

**Impact:**  
- Purchase products worth R10,000+ for R0.10
- Complete financial loss for sellers
- Platform commission loss
- Inventory depletion without revenue

**Exploitation Difficulty:** Low - Requires only browser developer tools

---

### VULN-002: PayFast IPN Source IP Not Validated [RESOLVED]

**Location:** `app/api/payfast/notify/route.ts`

**Resolution:**  
Implemented IP validation in `lib/payfast-security.ts` that validates all IPN requests originate from official PayFast IP addresses before processing. The validation includes:
- Legacy PayFast on-premises IP ranges (CIDR notation)
- New AWS IP addresses (21 IPs effective July 31, 2025)
- IP extraction from `x-forwarded-for`, `x-real-ip`, and `cf-connecting-ip` headers
- Requests from non-PayFast IPs are rejected with 403 Forbidden

**Original Description:**  
The PayFast Instant Payment Notification (IPN) endpoint validates the signature but does not verify that the request originates from PayFast's IP addresses.

**Original Attack Vector:**  
An attacker who knows or guesses an order ID can forge an IPN request:

1. Create a legitimate order (status: pending)
2. Craft a fake IPN POST request with `payment_status: COMPLETE`
3. Generate a valid signature using the known passphrase format
4. Send directly to `/api/payfast/notify`

If the passphrase is weak or leaked, the attacker can mark any order as paid without actual payment.

**Impact:**  
- Receive products without payment
- Seller funds credited to escrow for non-existent payments
- Inventory decremented without revenue
- Complete bypass of payment system

**Exploitation Difficulty:** Medium - Requires knowledge of signature algorithm and order IDs

---

### VULN-003: PayFast IPN Amount Not Verified [RESOLVED]

**Location:** `app/api/payfast/notify/route.ts`

**Resolution:**  
Added amount verification in the IPN handler that compares `amount_gross` from PayFast with the order's `total_amount` in the database. The verification:
- Fetches the order's `total_amount` from the database
- Compares it with the IPN `amount_gross` (with 1 cent tolerance for floating point)
- Rejects the IPN with 400 Bad Request if amounts don't match
- Also added idempotency check to skip already-paid orders

**Original Description:**  
The IPN handler does not verify that `amount_gross` from PayFast matches the order's expected `total_amount` in the database.

**Original Vulnerable Code:**
```typescript
const amount = data.amount_gross  // Never compared to order total
const orderId = data.custom_str1

// Order is marked as paid regardless of amount
await supabase
  .from("orders")
  .update({
    payment_status: "paid",
    status: "confirmed",
  })
  .eq("id", orderId)
```

**Original Attack Vector:**  
1. Create order for R10,000 worth of products
2. Initiate PayFast payment
3. Modify the payment amount to R1.00 before submission
4. PayFast processes R1.00 payment successfully
5. IPN marks R10,000 order as "paid"

**Impact:**  
- Pay R1 for R10,000 order
- Systematic underpayment attacks
- Seller receives fraction of expected payment

**Exploitation Difficulty:** Low - PayFast amount can be modified client-side

---

### VULN-004: User Wallet Balance Direct Modification via RLS [RESOLVED]

**Location:** `supabase/migrations/061_create_user_wallets.sql`

**Description:**  
The Row Level Security policy allows users to update their own wallet record without column restrictions:

```sql
CREATE POLICY "Users can update their own wallet" ON user_wallets
  FOR UPDATE USING (auth.uid() = user_id);
```

**Attack Vector:**  
Using the Supabase client directly (or via browser console):

```javascript
const { data, error } = await supabase
  .from('user_wallets')
  .update({ 
    available_balance: 999999.99,
    total_deposited: 999999.99 
  })
  .eq('user_id', currentUserId)
```

**Impact:**  
- Unlimited wallet balance creation
- Withdraw fabricated funds to bank account
- Complete financial system compromise

**Exploitation Difficulty:** Low - Requires only authenticated session and browser console

---

### VULN-005: SECURITY DEFINER Functions Callable by All Users [RESOLVED]

**Location:** `supabase/migrations/061_create_user_wallets.sql`

**Description:**  
Critical wallet manipulation functions are granted EXECUTE permission to all authenticated users:

```sql
GRANT EXECUTE ON FUNCTION record_wallet_deposit(UUID, DECIMAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_wallet_withdrawal(UUID, DECIMAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_to_wallet_escrow(UUID, DECIMAL, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION release_wallet_escrow(UUID, DECIMAL, UUID, TEXT) TO authenticated;
```

**Attack Vector:**  
```javascript
// Any authenticated user can call:
await supabase.rpc('record_wallet_deposit', {
  p_user_id: 'attacker-uuid',
  p_amount: 50000.00,
  p_payfast_payment_id: 'FAKE-123',
  p_description: 'Fake deposit'
})
```

**Impact:**  
- Create unlimited deposits without payment
- Release escrow funds prematurely
- Manipulate any user's wallet balance

**Exploitation Difficulty:** Low - Direct RPC call from browser

---

### VULN-006: Seller Can Modify All Transaction Fields [RESOLVED]

**Location:** `supabase/migrations/064_allow_sellers_update_transaction_escrow.sql`

**Description:**  
The RLS policy intended to allow sellers to update `escrow_status` actually permits updating ANY column on the transactions table:

```sql
CREATE POLICY "Sellers can update escrow_status for their orders" ON transactions
  FOR UPDATE USING (
    order_id IN (SELECT o.id FROM orders o WHERE o.shop_id IN (
      SELECT s.id FROM shops s WHERE s.user_id = auth.uid()
    ))
  )
```

**Attack Vector:**  
```javascript
await supabase
  .from('transactions')
  .update({ 
    amount: 100000.00,           // Inflate transaction amount
    commission_amount: 0,        // Remove platform commission
    seller_amount: 100000.00,    // Maximize seller payout
    escrow_status: 'released'    // Release funds immediately
  })
  .eq('order_id', 'my-order-uuid')
```

**Impact:**  
- Sellers can inflate their earnings
- Remove platform commission entirely
- Release escrow without delivery confirmation
- Falsify financial records

**Exploitation Difficulty:** Low - Direct database update from seller account

---

### VULN-007: Dual Balance System Inconsistency

**Location:** `supabase/migrations/056_add_balance_columns_to_shops.sql`, `supabase/migrations/061_create_user_wallets.sql`

**Description:**  
The system maintains balances in two places:
- `shops.available_balance` / `shops.locked_balance`
- `user_wallets.available_balance` / `user_wallets.locked_balance`

These are updated independently without atomic transactions or synchronization triggers.

**Attack Vector:**  
1. Exploit timing between shop balance update and wallet balance update
2. Initiate withdrawal from wallet while shop balance is being updated
3. Race condition allows double-spending

Alternatively:
1. Manipulate shop balance directly if RLS is misconfigured
2. Wallet balance remains unchanged
3. Withdraw from wallet, then claim shop balance discrepancy

**Impact:**  
- Double withdrawal of funds
- Balance inconsistencies causing financial discrepancies
- Audit trail corruption
- Dispute resolution impossible

**Exploitation Difficulty:** Medium - Requires timing manipulation or RLS bypass

---

### VULN-008: Monetary Precision Overflow [RESOLVED]

**Location:** All financial tables

**Description:**  
All monetary columns use `DECIMAL(10,2)` which limits values to 99,999,999.99. For a South African marketplace, this may be insufficient for:
- High-volume sellers
- Aggregate reporting
- Long-term balance accumulation

**Attack Vector:**  
1. Accumulate balance approaching R99,999,999.99
2. Receive additional payment that would exceed limit
3. Database constraint violation or silent overflow
4. Funds lost or system crash

**Impact:**  
- Data truncation or loss
- Transaction failures at scale
- Financial record corruption

**Exploitation Difficulty:** Low - Natural accumulation over time

---

## High Severity Vulnerabilities

### VULN-009: Withdrawal Funds Not Locked [RESOLVED]

**Location:** `app/api/wallet/withdraw/route.ts`

**Description:**  
When a user requests a withdrawal, the funds remain in `available_balance` until admin approval. The user can spend these funds while the withdrawal is pending.

**Vulnerable Code:**
```typescript
// Balance check
if (availableBalance < amount) {
  return NextResponse.json({ error: 'Insufficient balance' })
}

// Transaction created but balance NOT deducted
const { data: transaction } = await supabase
  .from('wallet_transactions')
  .insert({
    status: 'pending',
    // Balance stays in available_balance
  })
```

**Attack Vector:**  
1. Have R10,000 available balance
2. Request R10,000 withdrawal (pending)
3. Immediately make R10,000 purchase
4. Admin approves withdrawal
5. Attacker receives R10,000 + R10,000 in products = R20,000 value from R10,000

**Impact:**  
- Double-spending of wallet funds
- Platform financial loss
- Negative balance scenarios

**Exploitation Difficulty:** Low - Normal user actions

---

### VULN-010: SQL Injection in Admin User Search [RESOVED]

**Location:** `app/api/admin/users/route.ts`

**Description:**  
Search parameters are interpolated directly into the query without sanitization:

```typescript
if (search) {
  query = query.or(`full_name.ilike.%${search}%,first_name.ilike.%${search}%`)
}
```

**Attack Vector:**  
```
GET /api/admin/users?search=%'); DROP TABLE user_profiles; --
```

Or for data exfiltration:
```
GET /api/admin/users?search=%' OR '1'='1
```

**Impact:**  
- Data exfiltration of all user records
- Potential table deletion
- Privilege escalation via data manipulation

**Exploitation Difficulty:** Medium - Requires admin access first

---

### VULN-011: Admin Privilege Escalation via user_profiles [RESOLVED]

**Location:** `app/api/admin/users/route.ts`, RLS policies

**Resolution:**  
Implemented a separate `admins` table that can only be modified via service_role. The admin check functions (`is_user_admin`, `is_current_user_admin_or_service_role`) now query the `admins` table instead of the `user_profiles.is_admin` column. Key security improvements:
- Removed `is_admin` column from `user_profiles` table
- Created dedicated `admins` table with RLS policies that only allow service_role to modify
- Users can only read their own admin record (to check their status)
- All API routes updated to use the new `verifyAdmin()` function
- Frontend components updated to check the `admins` table
- Admin management now requires direct database access with service_role credentials

**Original Description:**  
Admin verification relied on `user_profiles.is_admin` column. If RLS policies allowed users to update their own profile, they could grant themselves admin access.

**Original Attack Vector:**  
```javascript
await supabase
  .from('user_profiles')
  .update({ is_admin: true })
  .eq('user_id', currentUserId)
```

**Impact:**  
- Any user becomes admin
- Access to all user data
- Ability to approve withdrawals
- Complete platform takeover

**Exploitation Difficulty:** Depends on RLS configuration

---

### VULN-012: Missing Stock Validation Before Order

**Location:** `app/api/orders/create/route.ts`

**Description:**  
Stock quantity is only decremented AFTER payment confirmation in the IPN handler. No stock reservation occurs during order creation.

**Attack Vector:**  
1. Product has 5 units in stock
2. 10 users simultaneously add to cart and checkout
3. All 10 orders created successfully
4. All 10 users pay via PayFast
5. Only 5 orders can be fulfilled
6. 5 users paid for unavailable products

**Impact:**  
- Overselling inventory
- Customer refund requirements
- Reputation damage
- Operational chaos

**Exploitation Difficulty:** Low - Natural concurrent usage

---

### VULN-013: Order Number Race Condition [RESOLVED]

**Location:** `supabase/migrations/003_create_orders_table.sql`

**Description:**  
Order number generation uses non-atomic MAX + 1 pattern:

```sql
SELECT 'ORD-' || LPAD((COALESCE(MAX(CAST(SUBSTRING(order_number FROM 5) AS INTEGER)), 0) + 1)::TEXT, 8, '0')
FROM orders
```

**Attack Vector:**  
Two concurrent orders:
1. Order A reads MAX = 100
2. Order B reads MAX = 100
3. Order A inserts ORD-00000101
4. Order B inserts ORD-00000101
5. Duplicate order numbers or constraint violation

**Impact:**  
- Duplicate order numbers
- Order tracking confusion
- Potential constraint violations crashing checkout

**Exploitation Difficulty:** Medium - Requires concurrent requests

---

### VULN-014: PayFast Wallet IPN Missing IP Validation [RESOLVED]

**Location:** `app/api/payfast/wallet-notify/route.ts`

**Resolution:**  
Implemented the same IP validation as VULN-002 fix. The wallet-notify endpoint now validates all IPN requests originate from official PayFast IP addresses using the shared `lib/payfast-security.ts` module before processing any wallet deposit notifications.

**Original Description:**  
Same vulnerability as VULN-002 but for wallet deposits. Attackers can forge deposit notifications.

**Original Attack Vector:**  
```bash
curl -X POST https://techafon.co.za/api/payfast/wallet-notify \
  -d "payment_status=COMPLETE&merchant_id=XXX&amount_gross=50000&custom_str1=wallet-deposit-uuid&signature=forged"
```

**Impact:**  
- Create unlimited wallet deposits
- Withdraw fabricated funds
- Complete financial system bypass

**Exploitation Difficulty:** Medium - Requires signature knowledge

---

### VULN-015: Service Role Key Exposure Risk [RESOLVED]

**Location:** `utils/supabase/server.ts`

**Description:**  
The Supabase service role key (which bypasses all RLS) is loaded in a file that could potentially be imported client-side:

```typescript
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const createClient = async (cookieStore, isAdmin: boolean = false) => {
  return createServerClient(
    supabaseUrl!,
    isAdmin ? supabaseAdminKey! : supabaseKey!,  // Dangerous pattern
  );
};
```

**Attack Vector:**  
If this module is accidentally imported in a client component, Next.js bundler may include the service role key in client JavaScript, exposing it to all users.

**Impact:**  
- Complete database access bypassing all RLS
- Read/write/delete any data
- Total platform compromise

**Exploitation Difficulty:** Requires developer mistake, but catastrophic if occurs

---

## Medium Severity Vulnerabilities

### VULN-016: Incomplete Route Protection [RESOLVED]

**Location:** `middleware.ts`

**Description:**  
The middleware only protects a limited set of routes:

```typescript
const protectedRoutes = ['/profile', '/dashboard', '/sell'];
```

Missing protection for:
- `/checkout` - Can access checkout flow
- `/wallet` - Can view wallet page
- `/orders` - Can view orders
- `/messages` - Can access messaging
- `/favorites` - Can view favorites
- `/cart` - Can access cart

**Attack Vector:**  
Unauthenticated users can access sensitive pages and potentially trigger actions or view cached data.

**Impact:**  
- Information disclosure
- Unauthorized access to user-specific pages
- Potential for CSRF attacks

**Exploitation Difficulty:** Low - Direct URL access

---

### VULN-017: FICA Document Deletion After Verification [RESOLVED]

**Location:** `app/api/fica-documents/route.ts`

**Description:**  
Users can delete their FICA verification documents even after being verified, potentially to hide fraudulent documents.

**Attack Vector:**  
1. Submit fraudulent FICA documents
2. Get verified by admin
3. Delete the fraudulent documents
4. No audit trail of original submission

**Impact:**  
- Regulatory compliance violation
- Fraud concealment
- Audit trail destruction

**Exploitation Difficulty:** Low - Normal API call

---

### VULN-018: File Upload Path Traversal [RESOLVED]

**Location:** `app/api/messages/upload/route.ts`, `components/part-image-upload.tsx`

**Description:**  
File extensions are extracted from user-provided filenames without sanitization:

```typescript
const ext = file.name.split('.').pop()
const fileName = `${chatId}/${Date.now()}-${Math.random()}.${ext}`
```

**Attack Vector:**  
Upload file named: `image.jpg/../../../etc/passwd`
Or: `image.jpg.exe`

**Impact:**  
- Path traversal to overwrite files
- Malicious file upload
- Potential remote code execution

**Exploitation Difficulty:** Medium - Depends on storage configuration

---

### VULN-019: Weak Password Policy [RESOLVED]

**Location:** `app/signup/page.tsx`

**Description:**  
Password validation only requires 6 characters:

```typescript
if (password.length < 6) {
  setError("Password must be at least 6 characters")
}
```

**Attack Vector:**  
- Brute force attacks feasible
- Dictionary attacks likely to succeed
- Credential stuffing effective

**Impact:**  
- Account takeover
- Access to user funds
- Identity theft

**Exploitation Difficulty:** Medium - Requires attack infrastructure

---

### VULN-020: Transaction Idempotency Missing [RESOLVED]

**Location:** `supabase/migrations/039_create_admin_tables.sql`

**Description:**  
The `transactions` table lacks a unique constraint on `payment_intent_id`, allowing duplicate transaction records if PayFast sends multiple IPNs.

**Attack Vector:**  
1. PayFast sends IPN for payment
2. Network timeout, PayFast retries
3. Both IPNs processed
4. Duplicate transaction records
5. Seller credited twice

**Impact:**  
- Double crediting of funds
- Financial discrepancies
- Audit complications

**Exploitation Difficulty:** Low - Can occur naturally

---

### VULN-021: Hard Delete of Financial Records [RESOLVED]

**Location:** `supabase/migrations/039_create_admin_tables.sql`

**Description:**  
Financial tables use `ON DELETE CASCADE`:

```sql
order_id UUID REFERENCES orders(id) ON DELETE CASCADE
```

**Attack Vector:**  
If an order is deleted (accidentally or maliciously), all associated transactions are permanently deleted.

**Impact:**  
- Loss of financial audit trail
- Regulatory compliance violation
- Inability to investigate disputes
- Tax reporting issues

**Exploitation Difficulty:** Requires delete access to orders

---

### VULN-022: Environment Variable Validation Missing [RESOLVED]

**Location:** `utils/supabase/client.ts`, `middleware.ts`

**Description:**  
Environment variables are used with `!` assertion without validation:

```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const createClient = () =>
  createBrowserClient(supabaseUrl!, supabaseKey!);
```

**Attack Vector:**  
If environment variables are missing or misconfigured:
1. Application crashes with cryptic errors
2. Potential fallback to insecure defaults
3. Debugging information exposed

**Impact:**  
- Application instability
- Potential security misconfigurations
- Information disclosure in errors

**Exploitation Difficulty:** Requires deployment misconfiguration

---

### VULN-023: Inconsistent URL Environment Variables [RESOLVED]

**Location:** Various API routes

**Description:**  
Two different variables used for same purpose:
- `NEXT_PUBLIC_BASE_URL` in PayFast routes
- `NEXT_PUBLIC_SITE_URL` in notification routes

**Attack Vector:**  
If only one is configured:
1. PayFast callbacks go to wrong URL
2. Notification links broken
3. Payment flow fails silently

**Impact:**  
- Payment processing failures
- Broken user experience
- Lost transactions

**Exploitation Difficulty:** Configuration error

---

## Low Severity Vulnerabilities

### VULN-024: Console Logging in Production [TEST]

**Location:** 61 files across the application

**Description:**  
273 instances of `console.log`, `console.error`, and `console.warn` statements throughout the codebase, including in authentication and payment flows.

**Examples:**
- `app/signup/page.tsx` - Logs user registration data
- `app/api/payfast/notify/route.ts` - Logs payment details
- `app/checkout/page.tsx` - Logs checkout flow

**Attack Vector:**  
1. Open browser developer console
2. Perform sensitive actions
3. View logged sensitive data
4. Capture authentication tokens, user data, payment info

**Impact:**  
- Information disclosure
- Debug information in production
- Potential credential exposure

**Exploitation Difficulty:** Low - Browser console access

---

### VULN-025: Missing .env.example File [TEST]

**Location:** Project root

**Description:**  
No `.env.example` file exists to document required environment variables.

**Attack Vector:**  
1. New developer sets up project
2. Misses critical security variables
3. Deploys with insecure defaults

**Impact:**  
- Deployment misconfigurations
- Security variables omitted
- Inconsistent environments

**Exploitation Difficulty:** Requires deployment access

---

### VULN-026: No Type Safety for Environment Variables [TEST]

**Location:** Throughout codebase

**Description:**  
TypeScript has no type definitions for environment variables, allowing typos and missing variables to go undetected until runtime.

**Attack Vector:**  
```typescript
// Typo goes unnoticed
const key = process.env.SUPABASE_SERVCE_ROLE_KEY  // Missing 'I'
```

**Impact:**  
- Runtime errors in production
- Silent failures
- Security misconfigurations

**Exploitation Difficulty:** Requires code changes

---

### VULN-027: Hardcoded Fallback URLs [TEST]

**Location:** `app/forgot-password/page.tsx`

**Description:**  
```typescript
const baseUrl = typeof window !== 'undefined' 
  ? window.location.origin 
  : 'http://techafon.com'  // Hardcoded production URL
```

**Attack Vector:**  
In development/staging, password reset emails contain production URLs, potentially:
1. Leaking reset tokens to production logs
2. Confusing users
3. Breaking reset flow

**Impact:**  
- Password reset failures
- Token exposure
- User confusion

**Exploitation Difficulty:** Low - Affects non-production environments

---

## Informational Findings

### INFO-001: No Rate Limiting

**Observation:**  
No rate limiting implemented on:
- Login attempts
- Password reset requests
- API endpoints
- Order creation

**Risk:** Brute force and denial of service attacks possible.

---

### INFO-002: No CSRF Protection

**Observation:**  
State-changing operations lack CSRF tokens. While Supabase auth provides some protection, custom API routes may be vulnerable.

**Risk:** Cross-site request forgery attacks on authenticated users.

---

### INFO-003: Missing Security Headers

**Observation:**  
No custom security headers configured in `next.config.mjs`:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

**Risk:** Clickjacking, XSS, and MIME-type attacks.

---

### INFO-004: No Audit Logging

**Observation:**  
Limited audit logging for sensitive operations:
- Balance changes
- Admin actions
- Permission changes
- Failed authentication

**Risk:** Inability to investigate security incidents.

---

## Appendix: Vulnerability by Component

| Component | Critical | High | Medium | Low |
|-----------|----------|------|--------|-----|
| Order Processing | 1 | 1 | 0 | 0 |
| Payment (PayFast) | 2 | 1 | 1 | 0 |
| Wallet System | 2 | 1 | 0 | 0 |
| Database RLS | 2 | 1 | 0 | 0 |
| Authentication | 0 | 1 | 2 | 0 |
| File Upload | 0 | 0 | 1 | 0 |
| Admin Functions | 0 | 1 | 0 | 0 |
| Environment Config | 0 | 1 | 2 | 3 |
| Middleware | 0 | 0 | 1 | 0 |
| Logging | 0 | 0 | 0 | 1 |
| Data Integrity | 1 | 1 | 1 | 0 |

---

**END OF REPORT**

*This document contains sensitive security information. Do not share externally.*
