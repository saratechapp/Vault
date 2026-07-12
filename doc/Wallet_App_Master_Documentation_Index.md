# 📚 WALLET APP - MASTER DOCUMENTATION INDEX
## Complete Reference Guide - All Files You Need

**Last Updated (implementation status):** July 3, 2026 (Recurring & Bills merger + Goals CRUD + themed Contribute modal + Debts strategy callout + data-driven Notifications + Modal component polish)
**Last Updated (planning docs):** July 2, 2026
**Total Documents:** 8 (6 planning + 2 implementation guides)
**Total Pages:** 150+ pages

---

# 🗞 RECENT CHANGES

## 2026-07-03

1. **Recurring & Bills merged into one page.** The Settings → Recurring tab and its `RecurringPanel` component are gone. Every rule is now a bill with `autoPost: true`. Sidebar and topbar label: **Recurring & Bills** (URL still `/app/bills`). Backend `/api/recurring/*` endpoints removed; `POST /api/bills/:id/run` replaces `POST /api/recurring/:id/run`. Existing `recurringRules[]` on disk are migrated into `bills[]` on first boot.
2. **Modal component enhanced across the app.** Sticky header + sticky footer + scrollable body inside `max-h-[90vh]`, subtle enter animation (`animate-modalIn` / `animate-modalPop`), and full `role="dialog"` + `aria-modal` + `aria-labelledby` accessibility wiring. All existing modal callers benefit automatically.
3. **Savings goals — full CRUD.** New `POST /api/goals`, `PATCH /api/goals/:id`, `DELETE /api/goals/:id`. Frontend `GoalModal` with 10-swatch color picker, hover Edit/Delete + confirm modal, empty-state CTA, and a data-driven "Highest priority" hero panel (was previously hardcoded "Emergency Fund · 85%"). Deep link `?add=1` opens the create modal.
4. **Contribute — themed modal.** The old `window.prompt` is gone. New `ContributeModal` with auto-focused amount, quick-add chips (`+₹500` / `+₹1,000` / `+₹5,000` / `+₹10,000` / `Max`), live projected balance/progress preview, `🎉 Target reached` badge, and a dynamic primary button label. Deep link `?contribute=<goal_id>` opens it on a specific goal.
5. **Debts strategy callout improved.** Always visible on both Avalanche and Snowball tabs. Detects convergence (identical timelines — common when the highest-APR debt is also the smallest balance) and names the dynamic winner. Includes a **"Switch to {winner}"** shortcut when viewing the sub-optimal tab.
6. **Notifications now auto-generated from real user data.** New backend function `generateNotificationsFor(userData)` derives rows from bill/budget/goal/transaction state; each has a deterministic `gen_<kind>_<sourceId>` ID. `userData.notifications` stores an overlay `{ id, read?, dismissed? }` so state survives backend restarts. Legacy hand-seeded rows still render. Frontend now respects a server-provided `tone` (danger / warning / success / info) so a "Bill overdue" chip is red while "Bill due soon" is amber.

---

# ⚡️ CURRENT IMPLEMENTATION STATUS (READ THIS FIRST)

The planning documents listed further down describe an *aspirational* Wallet
product covering mobile + web with bank sync, OCR, cloud sync, family sharing,
etc. **What has actually been built** is a **desktop web app** — a React 18 +
Vite + Tailwind frontend and a Node + Express backend, with all persistent
data encrypted at rest using AES-256-GCM.

The single source of truth for what the app looks like *today* and how to
rebuild it from scratch is:

> **[FULL_APP_RECREATION_GUIDE.md](FULL_APP_RECREATION_GUIDE.md)** — the
> complete end-to-end recreation guide. Read this if you want to understand,
> recreate, or extend the running application.

## What's implemented today (July 2026)

**Auth & multi-user**
- **Real authentication** — passwords hashed with Node `scrypt` + per-user salts + timing-safe compare
- **Token sessions** (`wtok_<hex>`) persisted inside the encrypted data file so restarts don't force everyone to re-login. 30-day expiry.
- **Per-user data isolation** — every signed-in user has a fully separate dataset; middleware attaches `req.userData` on every protected endpoint
- Signup validates minimum password length (6 chars); unique-email guard on POST /api/auth/signup
- Login errors surfaced as rose banner (`Invalid email or password.`)
- Automatic 401 handling on the client — clears localStorage and redirects to `/login`

**Frontend**
- Premium SaaS-style landing page (hero, features, pricing, testimonials, FAQ, CTA)
- Two-pane Login / Signup with password strength meter; **no more pre-filled demo credentials**
- Light + Dark theme (persisted, pre-hydrated to prevent FOUC)
- Multi-currency support: ~90 currencies · ~180 countries with defaults
- Live FX rates (Fawaz Ahmed's Currency API) with per-currency add flow
- Dashboard with customizable widget grid (drag & drop, add/remove, span resize)
- 11 dashboard widgets: Cash Flow, Financial Health, Expenses Structure, Balance Trend, Period-to-Period, Top Vendors, Savings Rate, Upcoming Bills, Top Goals, Recent Transactions, **This month's insight** (renamed from "AI Insight" — computed from real month-over-month delta / top category, no more hardcoded string)
- Proper empty-state UX on every widget + KPI card (muted `—` values, "add your first X" CTAs)
- Multi-account management (Bank / Savings / Credit / Cash / Wallet)
- Transactions: Income / Expense / **Transfer between accounts** with full edit support via a global modal
- Category management with **sub-categories fixed** (backend now accepts `parentId` on POST/PATCH), icon picker (~80 curated icons), color palette (18 swatches)
- Templates for quick record entry (CRUD + auto-apply)
- **Recurring & Bills** — one unified page (URL `/app/bills`). Recurring rules are modelled as bills with `autoPost: true` — on the due date the backend posts a real transaction and advances `dueDate`. Add-bill modal covers type/amount/category label + posting categoryId/due date/frequency/paid-from account/payment method/vendor/note plus **Auto-post** and cosmetic **Autopay** checkboxes. Cards show a 🔄 Auto-post chip plus ⚡ Run-now and ⏸ Pause hover icons; Mark-as-paid is hidden on auto-post rows.
- CSV import (drag/drop, column mapping, preview, bulk create)
- CSV exports on Transactions (filter-aware) and Reports (trend + categories)
- Budgets with custom periods (weekly / monthly / yearly / custom start-end) — `spent` **live-computed** from real transactions per the budget's window, including sub-categories
- **Recurring & Bills full CRUD** — Add / Edit / Delete modal covering auto-post + autopay, mark paid / mark pending, Run-now on auto-post rows, hover actions
- **Savings goals full CRUD** — themed `GoalModal` (create + edit) with 10-swatch color picker, hover Edit/Delete + confirm modal, empty state CTA, data-driven "Highest priority" hero panel (sorted by priority rank then completion %; renders "No goals yet" when empty), deep links `?add=1` and `?contribute=<id>`
- **Contribute (themed modal)** — replaces the old `window.prompt`. Goal summary, quick-add chips (`+₹500` / `+₹1,000` / `+₹5,000` / `+₹10,000` / `Max`), live projected balance/progress preview, `🎉 Target reached` badge, dynamic primary button label (`Add ₹X` / `Already reached`)
- Debt payoff planner (Snowball vs. Avalanche with interactive timeline). Strategy callout is **always visible on both tabs** — detects convergence, names the winner dynamically, and offers a **"Switch to {winner}"** shortcut when viewing the sub-optimal tab.
- **Notifications center — auto-derived from real data** via `generateNotificationsFor(userData)`. Triggers: bill overdue (red **Bill**), bill due soon (amber **Bill**), over budget (red **Budget**), budget alert (amber **Budget**), goal reached (emerald **Goal**), inactivity insight (cyan **Insight**). Each has a deterministic `gen_<kind>_<id>` so re-runs don't duplicate; `userData.notifications` stores an overlay `{ id, read?, dismissed? }` so state survives restarts. Legacy hand-seeded rows still render.
- **Modal component polish** — sticky header + sticky footer + scrollable body inside `max-h-[90vh]`, subtle enter animation (`animate-modalIn`/`animate-modalPop`), and `role="dialog"` + `aria-modal` + `aria-labelledby` on every dialog
- Reports (overview, by category, trends)
- Category-aware label suggestions with per-type scoping (transfer, income, expense) and category-name/account-name filtering
- **PIN lock** (4–8 digits, SHA-256 + per-user salt via Web Crypto)
- **Automatic idle logout** with 60-second warning modal
- Global "New transaction" modal accessible from any page
- **Wider Transactions search** (matches vendor, note, category, labels, payer, payment method, account name)
- **Reset filters (N)** button in Transactions when any filter is active
- **Dynamic sidebar badges** — Accounts / Transactions / Recurring & Bills (pending) / Notifications (unread) counts fetched live
- Chart tooltips use explicit theme hex colors (fully opaque, no more transparent-on-hover issue)

**Backend**
- Express server with compression + ETag revalidation (`Cache-Control: private, no-cache`)
- AES-256-GCM encryption of `sampledata.json` at rest (key from env var or `.data-key`)
- **Multi-user schema**: `{ users: [...], userData: { [id]: {...} }, sessions: {...} }`
- Live-derived analytics: `spendingTrend`, `categorySpend`, `monthlyIncome/Expense/savingsRate`, `budget.spent`, account balances — all recomputed from transactions in `computeIndexesFor()`
- Full CRUD for accounts, categories, budgets, bills (with `autoPost`), templates, goals, debts. Notifications are auto-derived + a persisted overlay for read/dismiss state.
- Transaction PATCH support with type migration (Income ↔ Expense ↔ Transfer)
- Bulk transaction insert (`POST /api/transactions/bulk`)
- **Auto-post engine** — on boot, iterates over `bills[]` with `autoPost=true`, posts a real transaction for every occurrence at or before today, advances `dueDate`, logs `[auto-post] checked (N active) · generated K scheduled transaction(s).` `POST /api/bills/:id/run` triggers the same logic on demand.
- Legacy `recurringRules[]` on disk are migrated into `bills[]` on first boot (one-time, non-destructive). The `/api/recurring/*` endpoints have been removed.
- Response cache is per-user (`etagBase:userId:route`) — no cross-user leakage

## What's aspirational (still in the planning docs, NOT built)

These items appear in the planning docs but are not implemented:

- Mobile app (React Native)
- Cloud sync / multi-device
- Real bank connections (Plaid / Salt Edge / Sahamati)
- Receipt OCR (Google ML Kit)
- Family sharing / collaboration
- Loyalty and reward card storage
- Real 2FA / biometric auth (toggles exist as UI stubs only)
- Push notifications (in-app rows are auto-generated and persist read/dismiss state, but external push/email delivery is not wired up)
- PDF export (CSV only)

If you're wondering "why isn't X in the app?" — it's probably in the list
above. See [FULL_APP_RECREATION_GUIDE.md](FULL_APP_RECREATION_GUIDE.md) §
*Future Enhancements* for the honest gap analysis.

---

## Original planning documents (aspirational — read for context, not truth)

---

# 📋 QUICK START: READ IN THIS ORDER

```
1. START HERE → Feature_Comparison_Removed_vs_Kept.md (15 min read)
   └─ Understand what you're building vs what was removed

2. THEN → Wallet_App_FREE_Version_Complete.md (30 min read)
   └─ Complete feature list + tech stack + timeline

3. THEN → Wallet_App_Launch_Strategy_Market_Viability.md (20 min read)
   └─ How to launch, get users, and make money

4. REFERENCE → Bank_API_Costs_Breakdown.md (as needed)
   └─ If you ever need bank sync APIs in the future

5. DEEP DIVE → Wallet_App_Complete_Project_Plan.md (if time)
   └─ Original detailed plan (might have removed features)

6. OPTIONAL → Wallet_App_Updated_Project_Plan_Simplified.md (if you prefer less detail)
   └─ Simplified version of the original plan
```

---

# 📁 ALL DOCUMENTS AVAILABLE

## **Document 1: Feature_Comparison_Removed_vs_Kept.md**
**Read Time:** 15-20 minutes  
**Size:** ~8 pages

### What's Inside:
- ✅ Features you're keeping (25+ features)
- ❌ Features removed (10 paid APIs removed)
- 💰 Cost savings comparison (₹60k-160k/month saved!)
- 📊 Side-by-side feature comparison table
- 🎯 Why each feature was kept or removed
- 📋 Complete feature checklist

### Best For:
- Understanding what app you're building
- Seeing what's NOT included (and why)
- Quick reference of all features
- Deciding if you want to add/remove anything

### Key Takeaway:
**25 world-class features, ZERO API costs**

---

## **Document 2: Wallet_App_FREE_Version_Complete.md**
**Read Time:** 30-40 minutes  
**Size:** ~20 pages

### What's Inside:
- 📊 Complete feature list (organized by Phase 1, 2, 3)
- 🛠️ Full technology stack (React, Node.js, React Native)
- 💻 Free APIs & open-source libraries only
- 📅 Development timeline (Week-by-week breakdown)
- 📋 Feature checklist (checkboxes you can use)
- 🏗️ System architecture
- 💰 Detailed cost breakdown (hosting, tools, etc.)
- 🚀 Next steps & quick start checklist

### Best For:
- Understanding EXACTLY what you're building
- Technical details (tech stack, architecture)
- Development timeline
- Cost planning
- Getting started immediately

### Key Takeaway:
**Complete blueprint for a FREE app that works offline, has OCR, and NO paywalls**

---

## **Document 3: Wallet_App_Launch_Strategy_Market_Viability.md**
**Read Time:** 20-30 minutes  
**Size:** ~18 pages

### What's Inside:
- ✅ Is your app ready to launch? (YES with 1-week prep)
- 📱 Expected downloads (5k-500k in year 1)
- 🌍 Global launch strategy
- 💰 Monetization roadmap (₹80 lakhs - ₹2 crores Year 1)
- 📈 Growth projections
- 🎯 Marketing strategy (4 phases)
- 📊 User acquisition tactics
- 🚀 30-day launch plan
- 🏆 Success factors
- ❌ Common mistakes to avoid

### Best For:
- Deciding whether to launch
- Understanding market opportunity
- Planning launch day
- Marketing strategy
- Revenue projections
- User growth strategy

### Key Takeaway:
**LAUNCH IN 2 WEEKS with proper strategy = 50k-500k users Year 1**

---

## **Document 4: Bank_API_Costs_Breakdown.md**
**Read Time:** 15-20 minutes  
**Size:** ~12 pages

### What's Inside:
- 💳 All bank API options (Razorpay, Plaid, Sahamati)
- 💰 Exact pricing for each option
- 🔒 Banking compliance & security requirements
- 📋 Technical requirements for bank integration
- 🎯 Recommended approach (CSV → Razorpay → Sahamati)
- 🚀 When to add bank sync (after 500+ users)
- 📊 Cost comparison table

### Best For:
- Understanding bank API options (if you want to add later)
- Cost planning (if considering paid APIs in future)
- Security & compliance requirements
- Deciding CSV vs real-time sync
- Reference when users ask for bank sync

### Key Takeaway:
**Start with CSV import (free), add Razorpay later when you have 500+ users (₹50-100k/month)**

---

## **Document 5: Wallet_App_Complete_Project_Plan.md**
**Read Time:** 40-60 minutes  
**Size:** ~30 pages

### What's Inside:
- 📊 Complete feature list (all 4 phases including removed features)
- 🛠️ Detailed tech stack (with alternatives)
- 💻 All third-party APIs & costs
- 🏗️ System architecture (detailed diagrams)
- 📅 36-week development timeline
- 💰 Complete cost breakdown
- 👥 Team structure recommendations
- 🧪 Testing strategy
- 🔒 Security & compliance
- 📱 API endpoints specification
- 🚀 Deployment checklist

### Best For:
- Deep technical understanding
- Enterprise-level planning
- Scaling strategy
- Complete reference
- Understanding alternatives

### Key Takeaway:
**Original comprehensive plan (includes features you removed)**

---

## **Document 6: Wallet_App_Updated_Project_Plan_Simplified.md**
**Read Time:** 30-40 minutes  
**Size:** ~20 pages

### What's Inside:
- 📊 Simplified feature list (no removed features)
- 🛠️ Tech stack
- 💰 Cost breakdown
- 📅 Development timeline
- 🤖 How to work with Claude AI
- 💡 Claude AI tips & best practices
- 📋 Complete feature checklist
- 🚀 Getting started

### Best For:
- Understanding Claude AI development process
- Learning how to work with Claude
- Simplified feature overview
- If you prefer less detail than the original plan

### Key Takeaway:
**How to use Claude to build 80-90% of the app code**

---

# 🎯 WHICH DOCUMENT TO READ FOR YOUR NEEDS

| Your Question | Read This Document |
|--------------|------------------|
| What am I building? | Feature_Comparison_Removed_vs_Kept.md |
| What's the complete feature list? | Wallet_App_FREE_Version_Complete.md |
| Tech stack & architecture? | Wallet_App_FREE_Version_Complete.md |
| How to launch this app? | Wallet_App_Launch_Strategy_Market_Viability.md |
| Will I get users? | Wallet_App_Launch_Strategy_Market_Viability.md |
| How much money can I make? | Wallet_App_Launch_Strategy_Market_Viability.md |
| What about bank sync APIs? | Bank_API_Costs_Breakdown.md |
| Development timeline? | Wallet_App_FREE_Version_Complete.md |
| How to work with Claude AI? | Wallet_App_Updated_Project_Plan_Simplified.md |
| Complete technical reference? | Wallet_App_Complete_Project_Plan.md |
| Should I launch this? | Wallet_App_Launch_Strategy_Market_Viability.md |
| What costs will I have? | Wallet_App_FREE_Version_Complete.md |

---

# 📍 DOCUMENT LOCATIONS & FILE NAMES

All documents are saved in: `/mnt/user-data/outputs/`

```
1. Feature_Comparison_Removed_vs_Kept.md
   └─ Location: /mnt/user-data/outputs/Feature_Comparison_Removed_vs_Kept.md

2. Wallet_App_FREE_Version_Complete.md
   └─ Location: /mnt/user-data/outputs/Wallet_App_FREE_Version_Complete.md

3. Wallet_App_Launch_Strategy_Market_Viability.md
   └─ Location: /mnt/user-data/outputs/Wallet_App_Launch_Strategy_Market_Viability.md

4. Bank_API_Costs_Breakdown.md
   └─ Location: /mnt/user-data/outputs/Bank_API_Costs_Breakdown.md

5. Wallet_App_Complete_Project_Plan.md
   └─ Location: /mnt/user-data/outputs/Wallet_App_Complete_Project_Plan.md

6. Wallet_App_Updated_Project_Plan_Simplified.md
   └─ Location: /mnt/user-data/outputs/Wallet_App_Updated_Project_Plan_Simplified.md

7. Wallet_App_Master_Documentation_Index.md (THIS FILE)
   └─ Location: /mnt/user-data/outputs/Wallet_App_Master_Documentation_Index.md
```

---

# 🚀 YOUR ACTION PLAN

## **Week 1: READ & UNDERSTAND**

```
Monday:
├─ [ ] Read: Feature_Comparison_Removed_vs_Kept.md (15 min)
└─ [ ] Understand: What you're building

Tuesday:
├─ [ ] Read: Wallet_App_FREE_Version_Complete.md (30 min)
└─ [ ] Understand: Complete feature list & tech stack

Wednesday:
├─ [ ] Read: Wallet_App_Launch_Strategy_Market_Viability.md (20 min)
└─ [ ] Understand: Launch strategy & market opportunity

Thursday:
├─ [ ] Read: Bank_API_Costs_Breakdown.md (if needed, 15 min)
└─ [ ] Reference: For future bank sync decisions

Friday:
├─ [ ] DECISION: Do you want to build this?
└─ [ ] DECISION: Ready to start development?
```

## **Week 2: PREPARE TO LAUNCH**

```
Follow the "Week 1-2 Get Ready" section in:
→ Wallet_App_Launch_Strategy_Market_Viability.md
```

## **Week 3: START DEVELOPMENT**

```
Start asking Claude for code:
1. "Design database schema" (use Claude AI guide from Wallet_App_Updated_Project_Plan_Simplified.md)
2. "Create Express.js server"
3. "Build React dashboard"
4. etc.
```

## **Week 4+: BUILD**

```
Use the timeline from:
→ Wallet_App_FREE_Version_Complete.md (Week-by-week breakdown)
```

---

# 💡 PRO TIPS

## **How to Use These Documents**

```
TIP 1: Print them or use PDF reader
   └─ Easier to reference while working

TIP 2: Use the Table of Contents
   └─ Jump to specific sections quickly

TIP 3: Bookmark important sections
   └─ For quick reference during development

TIP 4: Share with your team
   └─ Everyone knows the plan

TIP 5: Update as you go
   └─ Mark completed items
   └─ Add your own notes
   └─ Track progress

TIP 6: Refer to launch doc when marketing
   └─ Wallet_App_Launch_Strategy_Market_Viability.md has all marketing tips

TIP 7: Use Claude AI doc when coding
   └─ Wallet_App_Updated_Project_Plan_Simplified.md shows how to work with Claude
```

---

# 📊 DOCUMENT SUMMARY TABLE

| Doc # | Name | Pages | Time | Best For |
|-------|------|-------|------|----------|
| 1 | Feature_Comparison_Removed_vs_Kept.md | 8 | 15 min | Quick overview |
| 2 | Wallet_App_FREE_Version_Complete.md | 20 | 30 min | Building the app |
| 3 | Wallet_App_Launch_Strategy_Market_Viability.md | 18 | 20 min | Launching & marketing |
| 4 | Bank_API_Costs_Breakdown.md | 12 | 15 min | Future decisions |
| 5 | Wallet_App_Complete_Project_Plan.md | 30 | 60 min | Deep reference |
| 6 | Wallet_App_Updated_Project_Plan_Simplified.md | 20 | 30 min | Claude AI guide |

**TOTAL:** ~6-7 hours to read everything  
**RECOMMENDED:** 1-2 hours to read essentials (docs 1-3)

---

# 🎯 DECISION FRAMEWORK

## **Should You Build This?**

Answer these questions using the documents:

```
QUESTION 1: Is the market big enough?
ANSWER → Wallet_App_Launch_Strategy_Market_Viability.md (Market Size section)
RESULT: YES - 250M+ potential users globally

QUESTION 2: Are the features competitive?
ANSWER → Feature_Comparison_Removed_vs_Kept.md
RESULT: YES - Better than 80% of free budget apps

QUESTION 3: Can I build it with Claude?
ANSWER → Wallet_App_Updated_Project_Plan_Simplified.md (How to work with Claude section)
RESULT: YES - 8-12 weeks with Claude AI help

QUESTION 4: What will it cost?
ANSWER → Wallet_App_FREE_Version_Complete.md (Cost Breakdown section)
RESULT: ₹350-8,750/month infrastructure + ₹1,650/month Claude (optional)

QUESTION 5: When will I make money?
ANSWER → Wallet_App_Launch_Strategy_Market_Viability.md (Monetization section)
RESULT: Month 6+ → ₹2-50 lakhs/month revenue potential

QUESTION 6: How long until I launch?
ANSWER → Wallet_App_Launch_Strategy_Market_Viability.md (30-day plan)
RESULT: 2-3 weeks to launch if you start today

CONCLUSION: YES - BUILD THIS APP ✅
```

---

# ✅ FINAL CHECKLIST

Before you start, make sure you have:

```
[ ] Downloaded all 6 documents
[ ] Read documents 1-3 (minimum)
[ ] Understand the complete feature list
[ ] Know your tech stack
[ ] Know your launch strategy
[ ] Have Claude subscription (optional but helpful)
[ ] Ready to work with Claude AI
[ ] Understand the 12-week timeline
[ ] Know your monetization plan
[ ] Committed to launching (no perfectionism!)
```

---

# 🚀 YOU'RE READY TO START!

```
You have:
✅ Complete product plan
✅ Full tech stack defined
✅ Development timeline
✅ Launch strategy
✅ Monetization roadmap
✅ Marketing strategy
✅ All the guides you need

Next Step: START ASKING CLAUDE FOR CODE!

First request:
"I'm building a personal finance app. Please design a complete database schema with:
- users
- transactions
- categories
- budgets
- bills
- savings_goals
- receipts

Include all tables, relationships, indexes, and explain the structure."

Then follow the timeline in Wallet_App_FREE_Version_Complete.md
```

---

# 📞 QUICK REFERENCE LINKS

When you're building, refer to:

| Need | Document | Section |
|------|----------|---------|
| Feature list | Wallet_App_FREE_Version_Complete.md | Complete Feature Checklist |
| Tech stack | Wallet_App_FREE_Version_Complete.md | Technology Stack |
| Timeline | Wallet_App_FREE_Version_Complete.md | Development Timeline |
| Cost | Wallet_App_FREE_Version_Complete.md | Cost Breakdown |
| Launch | Wallet_App_Launch_Strategy_Market_Viability.md | 30-Day Plan |
| Marketing | Wallet_App_Launch_Strategy_Market_Viability.md | Marketing Strategy |
| Claude tips | Wallet_App_Updated_Project_Plan_Simplified.md | How to Work With Claude |
| APIs | Bank_API_Costs_Breakdown.md | (if you add bank sync later) |

---

# 📋 WHAT YOU'RE BUILDING

**TL;DR:**

```
APP NAME: Wallet - Personal Finance Manager

PLATFORM: Web (React) + Mobile (React Native)

FEATURES: 25+ (all FREE, no paywalls)
├─ Authentication (Google, Apple, Email)
├─ Manual transaction entry
├─ CSV bank import (no API cost)
├─ Receipt OCR (Google ML Kit - FREE)
├─ Budget tracking with alerts
├─ Reports & charts
├─ Bill management & reminders
├─ Savings goals
├─ Debt management
├─ Spending insights
└─ + 15 more

COST:
├─ Development: ₹0 (you do it) + Claude help (optional ₹1,650/mo)
├─ Infrastructure: ₹350-8,750/month
├─ APIs: ₹0 (all FREE)
└─ Total Year 1: ~₹80,000-2,00,000 infrastructure + optional Claude

TIMELINE: 8-12 weeks with Claude AI

LAUNCH: 2-3 weeks to prepare + launch

USERS: 50,000-500,000 in Year 1

REVENUE: ₹80 lakhs - ₹2 crores Year 1

STATUS: Ready to build NOW ✅
```

---

**SAVE THIS DOCUMENT FOR REFERENCE!**

Bookmark these documents and refer to them constantly during development.

**Questions? Ask Claude!**

*Happy building! 🚀*



