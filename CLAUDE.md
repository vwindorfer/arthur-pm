# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ArthurOS is a minimalist productivity management web app with a 4-level hierarchy: **Area Groups > Areas > Projects > Phases > Tasks**, Kanban views, resource management, and AI integration via Gemini. It uses Supabase for authentication and cloud data sync.

## Commands

```bash
npm run dev      # Start dev server (port 3000, binds to 0.0.0.0)
npm run build    # Production build with Vite
npm run preview  # Preview production build locally
npm run lint     # TypeScript type check (no emit)
npm run clean    # Remove dist/
```

No test framework is configured.

## Architecture

### Data Model

```
LifeOSData
  ├── inbox: Task[]
  ├── areaGroups: AreaGroup[]
  │   └── areas: Area[]
  │       ├── tasks: Task[]
  │       ├── projects: Project[]
  │       │   ├── phases: Phase[]
  │       │   │   └── tasks: Task[]
  │       │   └── resources: Resource[]
  │       └── resources: Resource[]
  └── completedTasks: Task[]
```

Types are defined in [src/types.ts](src/types.ts).

### State Management

All application state lives in the custom hook [src/hooks/useLifeOS.ts](src/hooks/useLifeOS.ts), which:
- Persists to `localStorage` under the key `life_os_data` (offline-first)
- Syncs to Supabase `user_data` table as a single JSON document per user (debounced 1s)
- Loads cloud data on login, pushes local data for new users
- Contains data migration/normalization logic for backward compatibility
- Exposes CRUD helpers: `addArea`, `deleteArea`, `deleteTask`, `deleteProject`, `deletePhase`, `updateData`

### Authentication

- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) — React context wrapping Supabase Auth (email/password sign up + sign in)
- [src/components/AuthPage.tsx](src/components/AuthPage.tsx) — Login/signup page
- [src/lib/supabase.ts](src/lib/supabase.ts) — Supabase client singleton
- App renders `AuthPage` when no user session exists

### Component Structure

The entire UI is in the monolithic [src/App.tsx](src/App.tsx). It contains:
- **Modals:** `CreationModal`, `EditTaskModal`, `EditProjectModal`, `EditPhaseModal`, `EditAreaModal`
- **Views:** `KanbanView`, `InboxView`, `CompletedView`, `SettingsView`
- **Helpers:** `TaskList`, `ProjectCard`, `ResourceList`, `Badge`, `IconButton`

Navigation is view-based with a `currentView` state variable.

### Key Task Properties

Tasks have: `status` (Backlog/In Progress/Done), `priority` (P1/P2/P3), `energy` (High/Low), labels, context tags, deadlines, and file attachments.

## Technology Stack

- **UI:** React 19, TypeScript 5.8, Tailwind CSS 4, lucide-react, motion (Framer Motion v12)
- **Build:** Vite 6 with `@tailwindcss/vite` plugin
- **Auth & Database:** Supabase (`@supabase/supabase-js`) — email/password auth + Postgres with RLS
- **Utilities:** date-fns, react-markdown, clsx, tailwind-merge
- **AI:** `@google/genai` (Gemini API)

## Environment Variables

```
GEMINI_API_KEY=             # Required for AI features; auto-injected by AI Studio
APP_URL=                    # Application host URL; auto-injected by AI Studio
VITE_SUPABASE_URL=          # Supabase project URL (Settings > API)
VITE_SUPABASE_ANON_KEY=     # Supabase anon/public key (Settings > API)
```

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run [supabase-setup.sql](supabase-setup.sql) in the SQL Editor to create the `user_data` table with RLS policies
3. Copy your project URL and anon key into `.env`
4. Enable email auth in Authentication > Providers

## Path Aliases

`@/` maps to the project root (configured in both `vite.config.ts` and `tsconfig.json`).
