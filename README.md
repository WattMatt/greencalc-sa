# WM Solar

Solar ROI Calculator for South Africa — calculate payback periods and savings for solar and battery installations based on municipal electricity tariffs.

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (auth, database, edge functions)
- Zustand (state management)
- TanStack React Query (data fetching)
- PWA enabled

## Local Development

```sh
# Install dependencies
npm install

# Start development server (port 8080)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Copy `.env` and update with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```
