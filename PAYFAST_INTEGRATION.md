# PayFast Integration Guide

This document explains the PayFast payment gateway integration for the South African marketplace.

## Overview

PayFast is integrated as the primary payment gateway for processing payments in South African Rand (ZAR).

## Environment Variables Required

Add the following variables to your `.env` or `.env.local` file:

```env
# PayFast Credentials
MERCHANT_ID=your_merchant_id_here
MERCHANT_KEY=your_merchant_key_here
PAYFAST_PASSPHRASE=your_passphrase_here

# PayFast URLs
PAYFAST_URL=https://sandbox.payfast.co.za/eng/process  # For testing
# PAYFAST_URL=https://www.payfast.co.za/eng/process   # For production

# Application Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # Update for production
```

### Environment Variables You Already Have:
- ✅ `MERCHANT_ID`
- ✅ `MERCHANT_KEY`

### Additional Variables You Need:

1. **PAYFAST_PASSPHRASE** (Optional but recommended)
   - Set this in your PayFast dashboard under Settings → Integration
   - Provides additional security by signing payment requests
   - If not set, signature will work without it but is less secure

2. **PAYFAST_URL**
   - Already assumed you have the sandbox URL saved
   - Use `https://sandbox.payfast.co.za/eng/process` for testing
   - Use `https://www.payfast.co.za/eng/process` for production

3. **NEXT_PUBLIC_BASE_URL**
   - Your application's base URL
   - Used for return URLs (success, cancel, and IPN notification)
   - Example: `https://yourdomain.co.za` for production

## Files Created/Modified

### API Routes

1. **`/app/api/payfast/generate-payment/route.ts`**
   - Generates PayFast payment data and MD5 signature
   - Called by checkout page before redirecting to PayFast

2. **`/app/api/payfast/notify/route.ts`**
   - Handles PayFast IPN (Instant Payment Notification)
   - Validates payment signature
   - Processes payment status updates
   - **TODO**: Add your database logic to mark orders as paid

### Pages

3. **`/app/checkout/page.tsx`** (Modified)
   - Integrated PayFast payment flow
   - Changed currency from USD ($) to ZAR (R)
   - Updated to use South African provinces
   - Removed country selector (South Africa only)
   - Auto-submits hidden form to redirect to PayFast

4. **`/app/payment/success/page.tsx`** (New)
   - Displayed after successful payment
   - Clears user's cart
   - Shows order confirmation

5. **`/app/payment/cancelled/page.tsx`** (New)
   - Displayed when payment is cancelled
   - Cart items remain saved

## How It Works

### Payment Flow

1. **User fills checkout form** with shipping details
2. **Clicks "Pay with PayFast"** button
3. **API generates payment data** with secure signature
4. **User is redirected to PayFast** payment gateway
5. **User completes payment** on PayFast
6. **PayFast redirects back** to success/cancel page
7. **PayFast sends IPN** (background notification) to verify payment

### Payment URLs

- **Success URL**: `https://yourdomain.co.za/payment/success`
- **Cancel URL**: `https://yourdomain.co.za/payment/cancelled`
- **Notify URL (IPN)**: `https://yourdomain.co.za/api/payfast/notify`

## Testing

### Sandbox Mode

1. Use your sandbox merchant credentials
2. Set `PAYFAST_URL` to sandbox URL
3. Use PayFast test cards (see [PayFast Documentation](https://developers.payfast.co.za/docs#step_3_test_the_payment))

### Test Card Numbers

PayFast provides test cards for sandbox testing. Common test scenarios:
- Successful payment
- Failed payment
- Pending payment

## Security

- ✅ MD5 signature validation on all payments
- ✅ Merchant ID verification
- ✅ Passphrase protection (recommended)
- ✅ Server-side payment generation
- ✅ IPN callback verification

## Production Checklist

Before going live:

- [ ] Update `PAYFAST_URL` to production URL
- [ ] Set production merchant credentials
- [ ] Set production `NEXT_PUBLIC_BASE_URL`
- [ ] Enable passphrase in PayFast dashboard
- [ ] Test IPN notifications work (must be accessible from internet)
- [ ] Implement database order updates in `/api/payfast/notify/route.ts`
- [ ] Set up email notifications
- [ ] Test all payment scenarios (success, cancel, failure)

## IPN (Instant Payment Notification)

The IPN endpoint (`/api/payfast/notify/route.ts`) receives payment status updates from PayFast.

**Important**: For IPN to work in production, your `notify_url` must be:
- Publicly accessible (PayFast must reach it)
- Using HTTPS (required for production)
- Responding with 200 OK status

### Current IPN Implementation

The IPN handler currently:
- ✅ Validates signature
- ✅ Verifies merchant ID
- ✅ Logs payment status
- ⚠️ **TODO**: Update database with payment status

### Next Steps for IPN

Add your business logic in `/app/api/payfast/notify/route.ts`:

```typescript
switch (paymentStatus) {
  case "COMPLETE":
    // TODO: Your code here
    // - Update order status to "paid"
    // - Send confirmation email
    // - Create shipment record
    // - Notify seller
    break;
}
```

## Currency Note

All prices are displayed in South African Rand (R). Make sure your product prices in the database are stored in ZAR.

## Support

- PayFast Documentation: https://developers.payfast.co.za/docs
- PayFast Support: support@payfast.co.za
- PayFast Dashboard: https://www.payfast.co.za/

## Troubleshooting

### Payment not completing
- Check MERCHANT_ID and MERCHANT_KEY are correct
- Verify signature generation matches PayFast requirements
- Check browser console for errors

### IPN not receiving notifications
- Ensure notify_url is publicly accessible
- Check PayFast logs in dashboard
- Verify server is responding with 200 OK

### Signature mismatch errors
- Ensure PAYFAST_PASSPHRASE matches dashboard setting
- Check all parameters are being signed correctly
- Verify encoding matches PayFast spec (spaces as +, not %20)

