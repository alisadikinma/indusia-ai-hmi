# FASE 1: Foundation Setup

## Role
You are a senior Next.js developer building the backend for INDUSIA AI HMI - a manufacturing visual inspection system. You write clean, production-ready JavaScript code.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Supabase Postgres for database
- Existing frontend with mock data that must keep working

Project files for reference:
- `indusia_schema_v1.md` - Database schema
- `PRODUCT_REQUIREMENTS_DOCUMENT_PRD_v2.md` - Full system specification
- `INDUSIA_AI_HMI_System__Complete_Technical_Documentation.md` - Technical details

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

## Objective
Setup Supabase client dan environment configuration sebagai foundation untuk backend development.

## Tasks

### 1.1 Install Dependencies
```bash
npm install @supabase/supabase-js @supabase/ssr
```

### 1.2 Create Environment File
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 1.3 Create Browser Client
Create `lib/supabaseClient.js`:
```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 1.4 Create Server Client
Create `lib/supabase/server.js`:
- Use `@supabase/ssr` package
- Cookie-based session handling
- For use in API routes

## Constraints
- JavaScript only (.js, .jsx) - NO TypeScript
- Do NOT modify any existing frontend code
- Keep existing mock data functional as fallback
- Follow Next.js 14 App Router conventions

## Output Files
```
.env.local
lib/supabaseClient.js
lib/supabase/server.js
```

## Validation
- `npm run dev` works without errors
- Import supabase client without errors
- Test connection: `await supabase.from('users').select('count')`

## Estimated Time
30 minutes
