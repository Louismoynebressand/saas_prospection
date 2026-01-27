# Environment Variables Configuration

## Overview

This document lists all environment variables required for the application to function properly.

---

## Required Variables

### Supabase (Public - Client-Side)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Where to find:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the URL and anon/public key

---

### Scraping Webhook (Server-Side ONLY)

```bash
# ⚠️ IMPORTANT: This should NOT have NEXT_PUBLIC prefix
SCRAPE_WEBHOOK_URL=https://your-n8n-instance.com/webhook/scrape
```

**Purpose:** Server-side webhook proxy to avoid CORS errors

**Security:** This URL is kept private on the server and never exposed to the client

**Where to configure in production (Vercel):**
1. Go to Vercel project settings
2. Navigate to Environment Variables
3. Add `SCRAPE_WEBHOOK_URL` with your n8n webhook URL
4. Select all environments: Production, Preview, Development

---

### Cold Email Webhook (Public - Client-Side)

```bash
NEXT_PUBLIC_N8N_WEBHOOK_COLD_EMAIL_URL=https://your-n8n-instance.com/webhook/cold-email
N8N_WEBHOOK_COLD_EMAIL=https://your-n8n-instance.com/webhook/cold-email
```

**Note:** Both variables point to the same webhook (one public, one private for compatibility)

---

## Local Development (.env.local)

Create a `.env.local` file in the root directory:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Scraping (server-side)
SCRAPE_WEBHOOK_URL=https://your-n8n-instance.com/webhook/scrape

# Cold Email
NEXT_PUBLIC_N8N_WEBHOOK_COLD_EMAIL_URL=https://your-n8n-instance.com/webhook/cold-email
N8N_WEBHOOK_COLD_EMAIL=https://your-n8n-instance.com/webhook/cold-email
```

---

## Production Deployment (Vercel)

### Checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL` added
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` added
- [ ] `SCRAPE_WEBHOOK_URL` added (no NEXT_PUBLIC prefix!)
- [ ] `NEXT_PUBLIC_N8N_WEBHOOK_COLD_EMAIL_URL` added
- [ ] `N8N_WEBHOOK_COLD_EMAIL` added
- [ ] All variables set for Production, Preview, and Development environments

### Adding Variables in Vercel

1. Go to your Vercel project
2. Click Settings → Environment Variables
3. Add each variable with:
   - **Key:** Variable name (e.g., `SCRAPE_WEBHOOK_URL`)
   - **Value:** Your value
   - **Environments:** Select Production, Preview, Development
4. Click "Save"
5. Redeploy your application for changes to take effect

---

## Migration Notes

### ❌ Removed (Old)

```bash
# This variable is NO LONGER USED
# NEXT_PUBLIC_SCRAPE_WEBHOOK_URL
```

**Why removed:** Exposing the webhook URL in the client bundle created CORS issues and security concerns. The webhook is now called server-side via `/api/scrape/launch`.

### ✅ Added (New)

```bash
# Server-side only webhook
SCRAPE_WEBHOOK_URL=...
```

**Benefits:**
- No CORS issues
- Webhook URL not exposed in client bundle
- Better error handling and logging
- Timeout control (30s max)

---

## Troubleshooting

### "SCRAPE_WEBHOOK_URL not configured on server"

**Cause:** The `SCRAPE_WEBHOOK_URL` environment variable is missing in your deployment

**Solution:** 
1. Add the variable in Vercel (see above)
2. Redeploy
3. Check logs to confirm it's loaded

### "Failed to fetch" errors still occurring

**Cause:** Possible issues:
- n8n webhook is down or unreachable
- Network timeout (>30s)
- Invalid webhook URL

**Solution:**
1. Test the webhook URL manually (e.g., with Postman)
2. Check n8n logs for errors
3. Verify the URL is correct in environment variables
4. Check the debugId in error messages for detailed logs

---

## Security Best Practices

1. **Never commit `.env.local`** - Add it to `.gitignore`
2. **Rotate keys periodically** - Especially after team member changes
3. **Use different keys for dev/prod** - Don't reuse production keys in development
4. **Monitor webhook access** - Check n8n logs for unauthorized access attempts
5. **Keep NEXT_PUBLIC prefix minimal** - Only use for truly public, client-side variables
