# Database Migration Notes

## Adding Page Notes Column

Run this SQL in pgAdmin to add the `notes` column to the `pages` table:

```sql
ALTER TABLE pages ADD COLUMN IF NOT EXISTS notes TEXT;
```

This migration is for the page notes/annotations feature added on 2025-12-26.

## Features Requiring Manual Database Updates

- Page notes/annotations (#30) - requires `notes` column in `pages` table
