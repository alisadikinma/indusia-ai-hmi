# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

INDUSIA AI HMI is a visual inspection manufacturing system built with Next.js and Supabase. It provides an end-to-end platform for managing AI-powered PCB inspections across operator HMI, manager console, engineering tools, and admin panels.

## Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint code
npm run lint

# Type checking
npm run typecheck
```

## Architecture

### Next.js App Router Structure

The app uses Next.js 13.5 with App Router. Pages are in `app/` with the following main routes:
- `/inspection/result/[id]` - Operator HMI for inspection results
- `/inspection/overrides` - Manager review queue for false call overrides
- `/engineering/master-data` - Engineering console for dataset/model management
- `/super-admin/*` - Admin panel for users, roles, permissions
- `/event-log` - System event tracking
- `/settings/sync` - Sync configuration

### Context Architecture

The app uses a nested context provider pattern in `app/layout-client.jsx`:

```
AuthProvider (outermost)
  └─ I18nProvider
      └─ HelpOverlayProvider
          └─ NotificationProvider
              └─ SystemHealthProvider (innermost)
```

All contexts are client-side only. The root layout (`app/layout.js`) wraps everything in `ToastProvider` and `LayoutClient`.

**Authentication Flow**: `AuthContext` stores user in localStorage as `indusia_user`. The `LayoutClient` redirects unauthenticated users to `/login`. Auth is currently mock-based and will be migrated to Supabase Auth.

### Role-Based Access Control (RBAC)

User roles are: `operator`, `manager`, `engineer`, `superadmin`

Navigation items in `SideNav.jsx` are filtered by role. Each route should check `user.role` for authorization. Use the `useAuth()` hook which provides:
- `user` - Current user object
- `isSuperAdmin` - Boolean helper
- `loginWithProfile()`, `logout()`, `updateSelections()`, `updateSelectedBoard()`

### Component Organization

- `components/ui/` - shadcn/ui primitives (Radix UI + Tailwind)
- `components/common/` - Reusable UI components (Card, Badge, StatusBadge, EmptyState, etc.)
- `components/layout/` - SideNav, TopNav
- `components/system/` - SystemHealthBar, SystemStatusChip, SystemStatusDetailsModal
- `components/notifications/` - NotificationBell, NotificationDrawer, NotificationFilters
- `components/inspection/` - FalseCallOverrideModal, OverrideReviewModal
- `components/sync/` - Sync progress and queue components
- `components/event-log/` - Event log table and filters
- `components/help/` - HelpOverlay system with context-aware shortcuts

### Styling System

Uses Tailwind CSS with custom INDUSIA design tokens in `tailwind.config.js`:

```js
indusia: {
  bg: '#0A1628',           // Main background
  surface: '#1A2942',      // Card/panel background
  surfaceMuted: '#152033', // Subtle backgrounds
  primary: '#0FB5BA',      // Primary actions/highlights
  text: '#E8EDF2',         // Main text
  textMuted: '#8A95A8',    // Secondary text
  pass: '#10B981',         // Success/pass status
  fail: '#EF4444',         // Error/fail status
  warning: '#F59E0B',      // Warning status
  border: '#2D3E56',       // Borders
}
```

Use these color tokens instead of arbitrary colors to maintain design consistency.

### Data Layer (Current State)

**Important**: The app currently uses mock data from `data/` directory:
- `data/masterData.js` - Customers, sections, lines, boards
- `data/mockEvents.js` - Event log data
- `data/mockNotifications.js` - Notification data

All custom hooks in `hooks/` currently use this mock data. The planned migration is:
1. Create repository layer in `lib/repos/`
2. Create API routes in `app/api/`
3. Update hooks to use Supabase client instead of mock data

When modifying data-related code, be aware that hooks will need to be refactored for Supabase integration.

### System Health Monitoring

`SystemHealthContext` provides real-time system status monitoring with these components:
- `aiModel` - AI model status and performance
- `camera` - Camera connectivity
- `cloud` - Cloud service connectivity
- `lineRuntime` - Production line status
- `lastSync` - Last sync operation status

States: `ok`, `warning`, `error`, `offline`, `degraded`, `unknown`, `in-progress`

The context auto-refreshes every 15 seconds and simulates random state changes for demo purposes. Remove the simulation logic when integrating with real system health APIs.

### Event Log System

Event logs track all system activities. Use the `useEventLog` hook which provides filtering, pagination, and CSV export. Event types include: `login`, `logout`, `override_submit`, `override_review`, `sync_start`, `sync_complete`, `training_start`, etc.

### Notifications System

`NotificationContext` manages in-app notifications. Notifications have:
- `type`: system, workflow, or alert
- `severity`: info, warning, error, success
- `category`: override, sync, training, system, etc.

Use `addNotification()` to create new notifications. The NotificationBell shows unread count and opens NotificationDrawer.

### Help Overlay System

`HelpOverlayContext` provides context-aware help overlays. Contexts are: `Global`, `HMI`, `Manager`, `Engineer`, `SuperAdmin`. The system automatically determines context from pathname in `layout-client.jsx`.

Press `?` to toggle help overlay on any page.

### Internationalization (i18n)

Use the `useI18n` hook for translations:

```jsx
const { t, language, setLanguage } = useI18n();
<h1>{t('nav.dashboard')}</h1>
```

Translation files are in `i18n/en.json` and `i18n/id.json`. Always add keys to both files when adding new translatable strings.

### Import Aliases

The project uses `@/` as a path alias mapping to the project root:

```js
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/button';
import { cn } from '@/lib/utils';
```

## Working with shadcn/ui Components

The project uses shadcn/ui built on Radix UI primitives. Components are in `components/ui/`. Configuration is in `components.json`.

To add new shadcn/ui components, they should be manually copied to `components/ui/` or use the shadcn CLI if available.

Always use the `cn()` utility from `@/lib/utils` for conditional className merging.

## TypeScript and JavaScript Mix

The codebase mixes TypeScript (.ts, .tsx) and JavaScript (.js, .jsx):
- UI components in `components/ui/` are TypeScript
- Most app pages and contexts are JavaScript
- Hooks are JavaScript

TypeScript errors are currently ignored during builds (`ignoreBuildErrors: true` in `next.config.js`). When adding new TypeScript files, ensure proper typing even though errors won't block builds.

## Environment Setup

Required environment variables (create `.env`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Key Implementation Patterns

### Override Workflow

False call overrides follow this flow:
1. Operator submits override via `FalseCallOverrideModal` (status: `pending`)
2. Manager reviews in `/inspection/overrides` using `OverrideReviewModal`
3. Manager approves or rejects (status: `approved` or `rejected`)
4. System creates event log entry and notification

### Modal Patterns

Modals use shadcn/ui Dialog component. Common pattern:

```jsx
const [isOpen, setIsOpen] = useState(false);

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    {/* Modal content */}
  </DialogContent>
</Dialog>
```

### Toast Notifications

Use the custom `useToast` hook:

```jsx
const { showToast } = useToast();
showToast('Operation completed successfully');
```

## Database Schema Notes

The full schema is in `indusia_schema_v1.md`. Key tables:
- `users`, `roles`, `role_menu_permissions` - RBAC
- `customers`, `sections`, `lines`, `boards` - Master data hierarchy
- `overrides` - False call override submissions
- `notifications`, `event_log` - Activity tracking
- `system_events` - System health events

When implementing Supabase queries, use Row Level Security (RLS) policies based on user roles.

## Future Integrations

The codebase is being prepared for:
1. Supabase authentication and database integration
2. FastAPI microservice for AI training (separate repo)
3. Modal.com integration for ML workflows
4. Semantic search with pgvector for override embeddings
5. AI Assistant with RAG using `kb_articles` table

Avoid hardcoding logic that assumes the current mock data structure will remain unchanged.
