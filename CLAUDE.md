# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static multi-page web app (no build step, no package manager) for a digital marketing agency (Momentum Digital) to manage restaurant client dashboards. All pages are plain HTML/CSS/JS files served directly from the filesystem or a static host.

## No Build System

There are no build tools, bundlers, package managers, or test frameworks. To "run" the project, open the HTML files directly in a browser or serve them with any static file server (e.g., `python -m http.server 8080`).

## Page Structure & Flow

```
index.html     → Login (Supabase auth)
  ↓ (on success)
admin.html     → Client list (CRUD for restaurant clients)
  ↓ (click a client)
periods.html   → Period list for a client (CRUD for monthly data)
  ↓ (link "Ver dashboard público")
dash.html      → Public-facing performance dashboard (?c=<slug>)
```

- `index.html` / `admin.html` / `periods.html` use `css/style.css` (dark theme design system)
- `dash.html` has all its CSS inlined — it is a standalone public page with a light theme (`--bg: #F4F3F0`)

## Supabase

All data and auth goes through Supabase (no backend server). The client is initialized with a hardcoded publishable URL and anon key in every HTML file:

```js
var SB = window.supabase.createClient(
  'https://mynolirdauvkubxvlddt.supabase.co',
  'sb_publishable_LnvMZ7skiOJ1p6CALaqDiA_0AtUfOku'
);
```

### Tables
- **`profiles`** — `id` (FK to auth.users), `full_name`
- **`clients`** — `id`, `name`, `slug` (unique, used in `?c=` URL), `logo_url`, `is_active`, `created_at`, `updated_at`
- **`periods`** — `id`, `client_id` (FK), `period_date` (stored as `YYYY-MM-01`), and ~25 numeric metric columns (see `FIELDS` map in `periods.html`)

### Storage
Client logos are uploaded to a Supabase Storage bucket named `logos`, under a `clients/` folder.

## Key Metric Fields (periods table)

| Field group | Columns |
|---|---|
| Revenue | `fat_total`, `fat_proprio`, `fat_ifood`, `fat_mesa`, `fat_delivery` |
| Orders | `pedidos_mesa`, `pedidos_delivery` |
| Own menu funnel | `cp_visitas`, `cp_views`, `cp_sacola`, `cp_revisao`, `cp_concluidos` |
| iFood funnel | `if_visitas`, `if_views`, `if_sacola`, `if_revisao`, `if_concluidos` |
| Paid traffic | `meta_invest`, `meta_vendas`, `google_invest`, `google_vendas`, `google_visitas_loja`, `google_rotas`, `crm_invest`, `crm_vendas` |

## dash.html Architecture

`dash.html` is self-contained (inline CSS, no external stylesheet). It:
1. Reads `?c=<slug>` from the URL to identify the client
2. Loads all periods for that client from Supabase, ordered by `period_date` descending
3. The `<select>` lets the viewer switch between months; deltas are computed by comparing the selected period with the previous one
4. Uses Chart.js (CDN) for line charts showing historical trends
5. Ticket médio (average ticket) is computed client-side: `fat / pedidos`

## Design System (`css/style.css`)

Dark theme. Key CSS variables: `--purple` is actually the brand red `#D42B2B` (named purple for historical reasons — do not rename). Fonts: `Plus Jakarta Sans` (body) and `JetBrains Mono` (numbers/values).

## Money Input Behavior

`periods.html` has a custom ATM-style money input (`setupMoneyInput`) that captures digits right-to-left and formats as `pt-BR` currency. It also handles paste from both BR (`1.234,56`) and EN (`1,234.56`) formats. The `parseVal()` function handles the same ambiguity on read-back.
