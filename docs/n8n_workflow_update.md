# n8n Workflow Changes - Implementation Guide

## Overview

The n8n workflow must be updated to work with the new UI-first architecture where the frontend creates the `scrape_jobs` row before calling the webhook.

---

## Changes Required

### 1. Remove Job Creation Node

**Current (OLD):**
```
Webhook → Supabase INSERT (create scrape_jobs) → Scraping Logic
```

**New:**
```
Webhook → Supabase GET (fetch existing job) → Update status → Scraping Logic
```

**Action:** Delete the Supabase INSERT node that creates `scrape_jobs`.

---

### 2. Add Job Fetch Node

**Node Type:** Supabase (GET)

**Configuration:**
- **Table:** `scrape_jobs`
- **Filter:** `id_jobs` = `{{ $json.meta.searchId }}`
- **Operation:** Get single row

**Purpose:** Fetch the job that was already created by the UI.

**Example Input (from webhook):**
```json
{
  "job": { ... },
  "actor": { ... },
  "meta": {
    "searchId": 12345  // ← Use this to fetch the job
  }
}
```

---

### 3. Update Job Status to 'running'

**Node Type:** Supabase (UPDATE)

**Configuration:**
- **Table:** `scrape_jobs`
- **Filter:** `id_jobs` = `{{ $json.meta.searchId }}`
- **Update Data:**
  ```json
  {
    "statut": "running"
  }
  ```

**Placement:** Immediately after fetching the job, before starting scraping.

---

### 4. Update Job Status on Completion

**Node Type:** Supabase (UPDATE)

**Configuration:**
- **Table:** `scrape_jobs`
- **Filter:** `id_jobs` = `{{ $json.meta.searchId }}`
- **Update Data:**
  ```json
  {
    "statut": "done"
  }
  ```

**Placement:** After all prospects have been scraped and inserted.

---

### 5. Update Job Status on Error

**Node Type:** Supabase (UPDATE)

**Configuration:**
- **Table:** `scrape_jobs`
- **Filter:** `id_jobs` = `{{ $json.meta.searchId }}`
- **Update Data:**
  ```json
  {
    "statut": "error"
  }
  ```

**Placement:** In error handler / catch block.

---

## New Workflow Structure

```
1. Webhook Trigger
   ↓
2. Supabase GET (fetch scrape_jobs by id_jobs)
   ↓
3. Supabase UPDATE (set statut = 'running')
   ↓
4. Google Maps Scraping Logic
   ↓
5. For each prospect:
   - Supabase INSERT (scrape_prospect)
   ↓
6. Supabase UPDATE (set statut = 'done')
   ↓
7. [Error Handler] Supabase UPDATE (set statut = 'error')
```

---

## Webhook Payload Changes

### Old Payload (UI sent this)
```json
{
  "job": {
    "source": "google_maps",
    "mapsUrl": "...",
    "query": "...",
    "location": { ... },
    "limits": { ... },
    "options": { ... }
  },
  "actor": {
    "userId": "uuid",
    "sessionId": null
  },
  "meta": {}  // ← Empty
}
```

### New Payload (UI now sends this)
```json
{
  "job": {
    "source": "google_maps",
    "mapsUrl": "...",
    "query": "...",
    "location": { ... },
    "limits": { ... },
    "options": { ... }
  },
  "actor": {
    "userId": "uuid",
    "sessionId": null
  },
  "meta": {
    "searchId": 12345  // ← NEW: id_jobs from UI
  }
}
```

---

## Testing Checklist

- [ ] Webhook receives `meta.searchId` correctly
- [ ] Job is fetched from Supabase (not created)
- [ ] Status updates to 'running' at start
- [ ] Prospects are inserted with correct `id_jobs`
- [ ] Status updates to 'done' on success
- [ ] Status updates to 'error' on failure
- [ ] UI shows real-time status updates

---

## Rollback Plan

If issues occur, you can temporarily:

1. Keep both INSERT and GET nodes
2. Use INSERT as fallback if GET returns null
3. Gradually migrate to new flow

---

## Notes

- The UI now creates jobs with `statut = 'queued'`
- n8n should NEVER create jobs, only update them
- All job data (query, city, options) is already in the database
- n8n can read from the fetched job row if needed
