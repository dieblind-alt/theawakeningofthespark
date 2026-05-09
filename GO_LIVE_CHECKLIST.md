# Go-Live Checklist

This document tracks all configuration settings that must be switched from test/sandbox mode to production mode before the book launch.

## 1. Environment Configuration (`.env`)
- [ ] `LULU_ENVIRONMENT`: Change from `sandbox` to `production`.
- [ ] `STRIPE_SECRET_KEY`: Switch from Test Mode secret key to Live Mode secret key.
- [ ] `STRIPE_WEBHOOK_SECRET`: Switch to the production Webhook secret (after setting up the live webhook endpoint in Stripe).

## 2. Book Content & PDFs
- [ ] **Upload Live Files:** Open your website, go to `?admin=true`, login, and use the **Fulfillment Files** menu to upload the final versions of your book PDFs (Hardcover Cover, Hardcover Interior, Softcover Cover, Softcover Interior, and Ebook).
- [ ] **Verify Status:** Ensure all 5 files show as "READY" in the Fulfillment Files menu.

## 3. Deployment & Webhooks
- [ ] Update Stripe Webhook: In the Stripe Dashboard, update the Webhook Endpoint URL to point to your live deployed server URL rather than the development preview URL.
- [ ] Lulu Account: Ensure your production Lulu API credentials are ready.

## 3. Deployment
- [ ] Ensure all code changes are committed and pushed.
- [ ] Trigger final deployment to production environment.

---
*We will update this list together as we move closer to the launch.*
