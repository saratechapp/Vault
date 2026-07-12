# Vault — Manual Testing Checklist

> **What this is.** A hands-on walkthrough of every functionality in the app.
> Do the sections **in order** — each one builds on the previous one.
> Check off ☐ boxes as you go.
>
> The sample data was reset to an **empty state** (no accounts, no
> transactions, no budgets, etc.) so you can trace every flow from a real
> clean start.

**App:** Vault — personal finance workspace (desktop web)
**Version:** 2026-07-03
**Prerequisites:** Node.js 18+, npm 9+

---

## Table of contents

- [Section 0 — Setup](#section-0--setup)
- [Section 1 — Landing page](#section-1--landing-page)
- [Section 2 — Signup & Login](#section-2--signup--login)
- [Section 3 — First look at the empty app](#section-3--first-look-at-the-empty-app)
- [Section 4 — Preferences (do this first)](#section-4--preferences-do-this-first)
- [Section 5 — Accounts](#section-5--accounts)
- [Section 6 — Categories](#section-6--categories)
- [Section 7 — Templates](#section-7--templates)
- [Section 8 — Transactions (Expense / Income / Transfer)](#section-8--transactions-expense--income--transfer)
- [Section 10 — Budgets (weekly / monthly / yearly / custom)](#section-10--budgets-weekly--monthly--yearly--custom)
- [Section 11 — Recurring & Bills](#section-11--recurring--bills)
- [Section 12 — Savings goals](#section-12--savings-goals)
- [Section 13 — Debts & payoff planner](#section-13--debts--payoff-planner)
- [Section 14 — Reports](#section-14--reports)
- [Section 15 — Notifications](#section-15--notifications)
- [Section 16 — Dashboard customization](#section-16--dashboard-customization)
- [Section 17 — CSV import & export](#section-17--csv-import--export)
- [Section 18 — Multi-currency & live FX](#section-18--multi-currency--live-fx)
- [Section 19 — Theme (light / dark)](#section-19--theme-light--dark)
- [Section 20 — Security: PIN lock](#section-20--security-pin-lock)
- [Section 21 — Security: Auto-logout on inactivity](#section-21--security-auto-logout-on-inactivity)
- [Section 22 — Data at rest is encrypted](#section-22--data-at-rest-is-encrypted)
- [Sign-off](#sign-off)

---

## Section 0 — Setup

### 0.1 Start the backend
- ☐ Open a terminal in `backend/`
- ☐ Run `npm install` (first time only)
- ☐ Run `npm run dev`
- ☐ **Verify** the console prints
  ```
  Wallet backend running on http://localhost:4000
  Data-at-rest: aes-256-gcm · key source: backend/.data-key (…)
  ```

### 0.2 Start the frontend
- ☐ Open a second terminal in `frontend/`
- ☐ Run `npm install` (first time only)
- ☐ Run `npm run dev`
- ☐ Open **http://localhost:5173** — the Landing page should load.

### 0.3 Reset PIN (if you already set one earlier)
- ☐ Open browser DevTools → Application → Local Storage → `http://localhost:5173`
- ☐ If `wallet_pin_v1` exists, delete it (or you'll be locked out at each visit)

**Section 0 complete when:** both servers are running and the browser shows the landing page.

---

## Section 1 — Landing page

**URL:** `/`

### 1.1 Layout & content
- ☐ Sticky nav at top with "Vault" logo, Features / Product / Pricing / FAQ links, **Sign in** link, **Get started** button, and a **theme toggle** (sun/moon icon)
- ☐ Hero: "Your money, beautifully managed." with **Start free — no card required** and **Live demo** buttons
- ☐ Trust bar under the hero with "Bank-grade encryption", "Your data stays yours", "Set up in 60 seconds"
- ☐ Interactive "hero preview" card with 3 stat mini-cards + a sparkline chart + 3 mini goal bars
- ☐ Trusted-by strip with brand names
- ☐ 6-item feature grid (Cash flow / Automated receipts / Goals / Smart nudges / Private / Multi-currency)
- ☐ Product preview section with a financial health card
- ☐ Metrics band (40,000+ users, ₹280 Cr tracked, 4.9/5, 99.99% uptime)
- ☐ 3 testimonials with 5-star ratings
- ☐ Pricing (Free / Pro — "Most popular" / Family)
- ☐ FAQ with 4 expandable rows
- ☐ Big bottom CTA card
- ☐ Footer with © link row

### 1.2 Interactions
- ☐ Click the theme toggle in the nav — page flips between light and dark, both look polished
- ☐ Click **Get started** → routes to `/signup`
- ☐ Click **Sign in** → routes to `/login`
- ☐ Click any FAQ row → it expands with an answer; click again → collapses

---

## Section 2 — Signup & Login

### 2.1 Signup (`/signup`)
- ☐ Two-pane layout: form on the left, gradient branded pane on the right (visible on desktop widths)
- ☐ Fields: **Full name**, **Work email**, **Password** (with show/hide eye)
- ☐ Password strength bar appears when typing:
  - Type `abc` → shows Weak
  - Type `abcd1234` → shows Fair
  - Type `Abcd1234` → shows Good
  - Type `Abcd1234!` → shows Strong
- ☐ Terms checkbox (checked by default)
- ☐ **Create free account** button is enabled once terms are checked

**Do the signup — auth is real now:**
- ☐ Fill in a name and email, any password of 6+ chars
- ☐ Click **Create free account**
- ☐ You are redirected to `/app/dashboard` with an **empty** dataset (each user starts fresh)

### 2.2 Duplicate-email guard
- ☐ Sign out (sidebar → log-out icon).
- ☐ Go to `/signup` and try to create another account with the **same email** as before.
- ☐ Rose error banner appears: `An account with this email already exists.`

### 2.3 Sign out and log back in
- ☐ Click the log-out icon at the bottom of the sidebar → you land on `/login`.
- ☐ **Login form starts empty** (no more prefilled demo credentials).
- ☐ Enter your correct email + password → click **Sign in** → back on `/app/dashboard`.
- ☐ Enter a **wrong password** → rose error banner: `Invalid email or password.`
- ☐ Enter a **wrong email** → same rose banner (we don't reveal which field is wrong).

### 2.4 Isolated data per user
- ☐ Sign up as `alice@example.com / alice12`.
- ☐ Add one account (e.g. `Alice's Checking`, ₹10,000).
- ☐ Sign out. Sign up as `bob@example.com / bob12345`.
- ☐ Bob sees **no accounts, no transactions** — completely fresh.
- ☐ Log out, log back in as Alice → her `Alice's Checking` account is back.

### 2.5 Session persistence across restarts
- ☐ Stay signed in as any user.
- ☐ In the **backend terminal**, `Ctrl+C` and restart with `npm run dev`.
- ☐ Refresh the browser — you are **still signed in** (tokens are persisted in the encrypted data file).

---

## Section 3 — First look at the empty app

You should now be on `/app/dashboard`.

### 3.1 Layout
- ☐ Sticky **left sidebar** with:
  - "Vault" brand mark on top
  - Nav items: Dashboard / Accounts / Transactions / Budgets / Bills / Savings goals / Debts / Reports / Settings (plus badges beside Accounts and Transactions)
  - Notifications count (bell) and profile chip at the bottom
  - "Upgrade to Pro" mini card
- ☐ Sticky **top bar** with:
  - Page title "Dashboard" + subtitle
  - Search box in the middle with `⌘K` chip
  - Theme toggle
  - Notifications bell
  - **New transaction** button
  - Your name + plan chip on the right

### 3.2 Empty state
- ☐ At the very top: a dashed "**+ Add your first account**" tile (because you have zero accounts)
- ☐ Below it: default widget grid — Cash Flow, Health, Expenses Structure, Bills, Goals, Recent Transactions, AI Insight
- ☐ Charts render but are empty / at 0 (no data yet — this is expected)

### 3.3 Sidebar navigation smoke test
- ☐ Click every nav item once (Accounts, Transactions, Budgets, Bills, Savings goals, Debts, Reports, Settings)
- ☐ Each page loads without a crash
- ☐ Each page shows a proper empty state (no rows, no crashes, no error banners)

**Come back to Dashboard for the rest of the flow.**

---

## Section 4 — Preferences (do this first)

Personalize the app before entering data.

- ☐ Go to **Settings → Preferences**

### 4.1 Location & currency
- ☐ **Country** dropdown: pick anything (try **United Arab Emirates**)
- ☐ Notice **Currency** flips to `AED` and **Time zone** to `Asia/Dubai` automatically
- ☐ Manually change currency to your own preference (e.g., `USD`)
- ☐ Live preview shows the sample amount formatted in that currency (e.g. `$1,234,567`)

### 4.2 Date format
- ☐ Click each of the 4 format cards — the preview updates below

### 4.3 Additional currencies + live FX
- ☐ Scroll to **Your currencies**
- ☐ Click **Add currency** → modal opens
- ☐ Pick any currency (e.g. `INR`) → **Exchange rate** and **Inverse exchange rate** fetch and display real numbers
- ☐ Click the small ↻ next to *Exchange rate* → rate re-fetches (bypasses cache)
- ☐ Click **Add** → the currency appears in the table with columns: `1 {base} = X`, inverse rate, and a remove button
- ☐ Click **Refresh** in the section header → the whole row(s) update

### 4.4 Save
- ☐ Click **Save changes** at the bottom of the panel → page reloads
- ☐ After reload, every rendered amount in the app uses the new currency (verify on the empty widgets or later once you add data)

**Optionally now**: switch to Light mode and stay there to test light styling, or back to Dark (Section 19).

---

## Section 5 — Accounts

**URL:** `/app/accounts`

### 5.1 Add first account
- ☐ Click **Add account** — modal opens
- ☐ Pick **Type**: try each option — the icon and default color change
- ☐ Choose **Bank**
- ☐ **Name:** `Main Checking`
- ☐ **Institution:** `Any Bank`
- ☐ **Opening balance:** `50000`
- ☐ Pick any color from the palette
- ☐ Click **Create account**
- ☐ Card appears in the grid with the color you picked; balance shows `50,000`

### 5.2 Add a credit card (with negative opening balance)
- ☐ Add another account: **Type = Credit**, name `Credit Card`, opening balance `-10000`
- ☐ Card renders in red-tinted balance style

### 5.3 Add a savings account and a wallet
- ☐ Add `Savings` (type = Savings) with `20000`
- ☐ Add `PhonePe` (type = Wallet) with `2000`

### 5.4 Verify summary
- ☐ Top summary cards recompute: **Total assets** should be `72,000`, **Total debt** `10,000`, **Net worth** `62,000`
- ☐ Hover a card → Edit + Delete icons appear
- ☐ Click **Edit** → modal opens pre-filled
- ☐ Change the color, click **Save changes** → color updates on the card immediately

### 5.5 Verify Dashboard accounts strip
- ☐ Go back to `/app/dashboard`
- ☐ At the top, a **horizontal scrollable row** of colored account pills appears — one per account, in the color you set — plus a dashed "Add account" tile at the end
- ☐ Each pill shows the account name, big balance number, and a ghost icon in the corner
- ☐ Scroll horizontally with the mouse wheel — it scrolls smoothly with snap points

---

## Section 6 — Categories

**Path:** Settings → Categories

### 6.1 Default categories
- ☐ 12 categories are already listed (Food, Transport, Shopping, Bills, Entertainment, Health, Travel, Education, Salary, Freelance, Other, Transfer)

### 6.2 Add a new top-level category
- ☐ Click **Add category** → modal opens
- ☐ **Name:** `Gifts`
- ☐ Pick a color, pick an icon (try the search box in the icon picker — search "gift")
- ☐ Leave **Parent category** as `None (top-level)`
- ☐ Click **Create category**
- ☐ New card appears in the list with icon in gradient tile

### 6.3 Add a sub-category
- ☐ Hover the **Food & Dining** parent card → click the **+** icon that appears
- ☐ Modal opens with **Parent category** already set to Food & Dining
- ☐ Name `Groceries`, pick an icon, save
- ☐ New sub-category appears indented under Food & Dining
- ☐ Repeat: add `Dining out`, `Coffee` under Food & Dining

### 6.4 Edit and delete
- ☐ Hover the `Gifts` category → click the pencil (Edit)
- ☐ Change the color or name and save → updated in place
- ☐ Hover it again → click the trash (Delete) → confirmation modal appears
- ☐ Confirm → category removed

### 6.5 Delete-in-use guard (skip for now, revisit after Section 8)
- ☐ Note: once you have a transaction referencing a category, deleting that category shows a friendly error. Test this later.

---

## Section 7 — Templates

**Path:** Settings → Templates

- ☐ Empty list initially
- ☐ Click **Add template**
- ☐ Fill:
  - Name: `Morning coffee`
  - Type: Expense
  - Amount: `300`
  - Vendor: `Blue Tokai`
  - Category: `Coffee` (the sub-category you added)
  - Account: `PhonePe`
  - Payment method: UPI
- ☐ Save → template appears as a card
- ☐ Hover → Edit / Delete affordances
- ☐ Add one more for Salary (type = Income, amount `100000`, category Salary, account `Main Checking`)

*You'll use these templates in the next section.*

---

## Section 8 — Transactions (Expense / Income / Transfer)

**URL:** `/app/transactions`

### 8.1 First look at empty state
- ☐ 4 stat cards on top (Income / Expense / Transfers / Net) all showing `0`
- ☐ Filter bar with Search, Type, Account, Category dropdowns, "More filters", Import, Export, and **New transaction**
- ☐ Below: empty-state block ("No matches")

### 8.2 Add an expense
- ☐ Click **New transaction** — the two-column Add Record modal opens
- ☐ Verify layout:
  - Left: template dropdown + `+` toggle, then Expense/Income/Transfer tabs, Amount+Currency, Account (icon), Category (icon), Labels (with suggestions), Date & Time, "Create template from this record"
  - Right: "Other details" — Note, Payer, Payment type, Payment status
  - Bottom: **Add record** + **Add and create another** side by side
- ☐ Ensure **Expense** tab is selected (highlights red)
- ☐ Pick your `Morning coffee` template from the dropdown → the form auto-fills
- ☐ Adjust amount to `250`
- ☐ Click **Add record**
- ☐ Modal closes; the row appears at the top of the table with the right icon + colored amount

### 8.3 Add an income
- ☐ Click **New transaction** (from the Topbar this time — verify it works from anywhere)
- ☐ Switch to **Income** tab (emerald)
- ☐ Pick your Salary template
- ☐ Change date to today
- ☐ Click **Add record**
- ☐ Row appears with green amount + up-arrow icon

### 8.4 Add a transfer
- ☐ **New transaction** → **Transfer** tab (brand color)
- ☐ From account: Main Checking · To account: Savings
- ☐ Amount: `20000`
- ☐ Description: `Monthly savings sweep`
- ☐ Add record
- ☐ Row appears with left-right arrow icon and "Main Checking → Savings" account pill

### 8.5 Test "Add and create another"
- ☐ Open the modal → fill an expense (e.g., `Lunch`, `450`, Food category)
- ☐ Click **Add and create another** → modal stays open with the amount + vendor cleared for the next entry
- ☐ Add another expense and click **Add record** to close

### 8.6 Label suggestions
- ☐ Open the modal, pick **Category = Coffee**
- ☐ Under Labels you should see a "For this category" (or "From your history") header + clickable label chips based on any labels you've used before
- ☐ Add a label like `daily` via a chip click → it appears as a removable brand-colored chip above the suggestions

### 8.7 Filtering
- ☐ In the search box, type "coffee" → only coffee-related rows show
- ☐ Change **Type** dropdown to Income → filter narrows
- ☐ Change **Account** dropdown to a specific account → further narrowed
- ☐ Stat cards recalculate as filters change
- ☐ Reset filters via the empty-state button or by clearing the dropdowns

### 8.8 Delete
- ☐ Hover a row → trash icon → click → row disappears immediately

### 8.9 Add-record button works from every page
- ☐ Navigate to Dashboard → click **New transaction** in the Topbar → modal opens with pickers already loaded
- ☐ Add a transaction → after saving, both Dashboard **and** Transactions list refresh automatically

### 8.10 "Create template from this record"
- ☐ Open Add Record → fill a new expense you haven't templatized
- ☐ Click the green `+` button next to Select template → toggle-on state
- ☐ Click **Add record** → new template appears in Settings → Templates

### 8.11 Verify Dashboard picks up the data
- ☐ Go to Dashboard
- ☐ Cash Flow widget shows income vs expense (with your last month having entries)
- ☐ Expenses Structure donut has colored slices + total in the middle
- ☐ Recent Transactions widget shows your recent rows
- ☐ Accounts strip balances updated to reflect the money in/out

---

## Section 9 — (removed)

*Recurring transactions have been merged into [Section 11 — Recurring & Bills](#section-11--recurring--bills). The old **Settings → Recurring** panel is gone; the same functionality now lives on the Bills page via the **Auto-post to ledger** toggle.*

---

## Section 10 — Budgets (weekly / monthly / yearly / custom)

**URL:** `/app/budgets`

### 10.1 Overview cards
- ☐ Empty state: Total budget / Total spent / Remaining / Overall usage all `0`

### 10.2 Add a monthly budget
- ☐ Click **New budget**
- ☐ Category: Food & Dining
- ☐ Limit: `10000`
- ☐ Alert at: `80`
- ☐ Period: **Monthly**
- ☐ Save
- ☐ Card appears; if you've added food expenses, the progress bar is filled proportionally

### 10.3 Add a weekly budget
- ☐ New budget with any category, period **Weekly**
- ☐ Card shows "Weekly" under the category name

### 10.4 Add a yearly budget
- ☐ New budget, period **Yearly**

### 10.5 Add a custom budget
- ☐ New budget, period **Custom** → start and end date fields appear
- ☐ Pick any 3-month window, save
- ☐ Card shows the date range under the category

### 10.6 Overspend visualization
- ☐ Add an expense (Section 8 flow) that pushes one budget past 80% or 90% of its limit
- ☐ Return to Budgets → that card:
  - Shows an amber or rose alert chip in the top-right with the percentage
  - Progress bar color changes to amber (≥75%) or rose (≥90%)

### 10.7 Edit / Delete
- ☐ Hover a budget card → edit / delete affordances
- ☐ Edit works; delete asks for confirmation

---

## Section 11 — Recurring & Bills

**URL:** `/app/bills` · **Sidebar label:** *Recurring & Bills*

> This section covers **two flavours** on the same page:
> - **Reminder bills** — the classic Bill: you click *Mark as paid* each cycle. `autoPost = false`.
> - **Auto-post bills** — the old "Recurring rule" reborn: on each due date the backend posts a transaction to the ledger. `autoPost = true`.
>
> Both live in the same list and use the same **Add bill** modal — flip the *Auto-post to ledger* checkbox to switch flavour.

### 11.1 First look (empty)
- ☐ Three summary cards at the top: **Total this month / Paid / Pending** — all showing muted `—`.
- ☐ Empty state card: *"No bills tracked yet"* with an **Add your first bill** CTA.

### 11.2 Add a reminder bill (manual mark-paid)
- ☐ Click **Add bill** — the modal opens.
- ☐ Fill:
  - Bill name: `Home Rent`
  - Amount: `24000`
  - Category (label): **Rent**
  - Category (for posting): leave — or pick **Bills & Utilities** if you'd like
  - Due date: today + 5 days
  - Frequency: **Monthly**
  - Paid from account: any bank account you added earlier
  - **Auto-post to ledger:** leave **unchecked**
  - **Autopay is set up:** leave unchecked
- ☐ Click **Add bill** → modal closes → the card appears under **Pending**.
- ☐ Because the due date is ≤ 5 days away, the icon tile is rose-tinted and "in X days" is red.
- ☐ The card shows a **Mark as paid** button at the bottom.

### 11.3 Add an autopay reminder (cosmetic chip only)
- ☐ Add bill: name `Netflix`, amount `649`, Category (label) **Subscription**, Frequency **Monthly**, Paid from any credit card account, **Autopay on**, **Auto-post to ledger off**.
- ☐ Card appears with a blue **⚡ Autopay** chip in its header.
- ☐ No transaction is created — this is just a visual reminder that your bank handles the debit.

### 11.4 Add an auto-post subscription (was "Recurring")
- ☐ Click **Add bill**
- ☐ Fill:
  - Bill name: `Prime Video`
  - Amount: `299`
  - Type: **Expense**
  - Category (for posting): **Entertainment** *(required when auto-post is on)*
  - Due date: **today's date**
  - Frequency: **Monthly**
  - Paid from account: any Credit Card account
  - Payment method: **Credit Card**
  - Vendor: `Prime Video`
  - **Auto-post to ledger:** **check it on**
- ☐ Save → the card appears with a **🔄 Auto-post** brand chip in the header.
- ☐ Notice the **Mark as paid** button is **hidden** on this card — the transaction *is* the proof of payment.

### 11.5 Run now (⚡) on an auto-post bill
- ☐ Hover the **Prime Video** card → click the **⚡** lightning icon.
- ☐ Go to Transactions → a new `Prime Video -299` row appears with label `recurring` and note ending in `[recurring]`.
- ☐ Back on the Bills page, the card's **Due** date has advanced by one month.

### 11.6 Auto-generation on boot
- ☐ Edit the Prime Video bill → change **Due date** to **yesterday** and Save.
- ☐ Restart the backend (Ctrl+C in the backend terminal, then `npm run dev`).
- ☐ On boot, the console prints `[auto-post] checked (… active) · generated 1 scheduled transaction(s).`
- ☐ Transactions list has another `Prime Video` row with today's date; the bill's **Due** date has advanced to next month.

### 11.7 Pause / resume an auto-post bill

Hover the auto-post card to see its action icons:

| Icon | When it shows | What it does |
| --- | --- | --- |
| ⏸ **Pause** | auto-post is running | Stops boot-time generation. Card shows a **Paused** chip. |
| ▶ **Play** | auto-post is paused | Resumes the auto-post schedule. Chip disappears. |
| ⚡ **Run now** | always (on auto-post cards) | Immediately posts one transaction, **regardless of pause state**. |
| ✏️ **Edit** | always | Opens the bill in the modal for changes. |
| 🗑 **Delete** | always | Removes the bill. Existing generated transactions are kept. |

Walk-through:
- ☐ Click **⏸ Pause** on the Prime Video card. It flips to an emerald **▶ Play** icon and a **Paused** chip appears.
- ☐ Click **⚡ Run now**. Confirm in the terminal that a transaction was still generated — Run now is a manual override.
- ☐ Click **▶ Play** to resume. Chip disappears and the icon flips back to **⏸ Pause**.

### 11.8 Mark as paid + revert (reminder bills only)
- ☐ On the **Home Rent** card, click **Mark as paid** → the card moves to the **Paid this month** list at the bottom, wrapped in a success chip.
- ☐ Hover the paid row → click the clock icon to move it back to **Pending**.

### 11.9 Edit + Delete
- ☐ Hover any pending card → click ✏️ **Edit** → modal opens pre-filled. Change the amount to `25000` → **Save changes** → card updates in place.
- ☐ Hover any card / row → click 🗑 **Delete** → confirmation modal → confirm → the row disappears and summary cards recompute.

### 11.10 Validation
- ☐ **Add bill** → leave Name blank → click Add → rose error `Please enter a bill name.`
- ☐ Set amount to `0` → click Add → rose error `Please enter an amount greater than 0.`
- ☐ Tick **Auto-post to ledger** but leave *Category (for posting)* as `— None —` → rose error `Auto-post bills need a category so we know how to book the transaction.`

---

## Section 12 — Savings goals

**URL:** `/app/goals`

### 12.1 First look (empty)
- ☐ Strong hero card shows *"Total progress across 0 goals"* with `₹0 of ₹0`, `0% saved · Add your first goal to begin.`
- ☐ "Highest priority" panel shows *"No goals yet"*.
- ☐ Empty-state card below with a **Target** icon: *"No savings goals yet"* and an **Add your first goal** CTA.

### 12.2 Create a goal
- ☐ Click **New goal** in the hero card (or **Add your first goal** in the empty state) → modal opens with title *"New savings goal"*.
- ☐ Fill:
  - Goal name: `Emergency fund`
  - Target amount: `100000`
  - Saved so far: `20000`
  - Deadline: any date ~6 months out
  - Priority: **High**
  - Planned monthly contribution: `10000`
  - Color: pick any swatch (a ring appears around the picked one)
  - Note: leave blank
- ☐ Click **Create goal** → modal closes, card appears in the grid.
- ☐ Card shows: name, `high priority`, `On track` chip (green), progress bar at 20%, `Saved ₹20,000 / Target ₹100,000`, `₹80,000 to go`, deadline, and a **Monthly need** tile.

### 12.3 Create a second, low-priority goal
- ☐ **New goal** → name `Laptop`, target `80000`, saved `0`, priority **Low**, no deadline, no monthly contribution.
- ☐ New card appears. It shows `low priority`. **On track** chip is still green (no deadline + no planned pace = neutral).

### 12.4 Contribute
- ☐ On the Emergency fund card → click **Contribute** → **themed modal** opens (not a browser prompt).
- ☐ Modal header shows *Contribute* + the goal name as subtitle.
- ☐ Top of modal shows the goal's current progress card (icon, name, saved / target, %, progress bar).
- ☐ **Amount to contribute** input is auto-focused.
- ☐ Quick-add chips appear: `+₹500`, `+₹1,000`, `+₹5,000`, `+₹10,000`, and `Max (₹remaining)`. Click one → the input fills with that amount.
- ☐ Type `10000` (or click the `+₹10,000` chip) → a live preview panel appears with:
  - *"New balance ₹30,000 / ₹100,000"*
  - a projected progress bar
  - *"30% complete"*
  - primary button label updates to `Add ₹10,000`
- ☐ Click **Add ₹10,000** → modal closes; card refreshes: saved `₹30,000`, progress bar advances, `₹70,000 to go`.
- ☐ Hero card *Total progress* number updates.

### 12.4a Contribute — edge cases
- ☐ Open Contribute again → type `500000` (more than remaining) → preview panel shows `🎉 Target reached` in green + an amber note *"Only ₹X needed — extra will be ignored."*  Click Add → saved caps at target.
- ☐ Reopen Contribute on the now-fully-funded goal → an emerald panel shows *"You've already hit this goal. Nice work!"* and the primary button reads **Already reached** (disabled).
- ☐ Contribute with amount `0` or empty → primary button stays disabled; if you clear the field and try to submit, rose error `Please enter an amount greater than 0.`

### 12.5 Highest priority is derived from data
- ☐ Hero panel's *Highest priority* now shows `Emergency fund` with the current % complete (the High-priority goal outranks the Low-priority one).
- ☐ Edit the Emergency fund → change priority to **Low** → Save → panel now falls back to the goal that is closest to complete among the remaining.

### 12.6 Edit
- ☐ Hover a card → click ✏️ **Edit** → modal reopens titled *"Edit goal"*, pre-filled.
- ☐ Change **Target** to `120000`, **Save changes** → card updates in place (progress % re-computes; hero totals shift).

### 12.7 Delete
- ☐ Hover a card → click 🗑 **Delete** → confirmation modal *"Delete goal?"* with the goal summary → **Delete** → card disappears, hero totals recompute.

### 12.8 Validation
- ☐ **New goal** → leave Name blank → **Create goal** → rose error `Please enter a goal name.`
- ☐ Set Target to `0` → rose error `Please enter a target amount greater than 0.`
- ☐ Set Saved higher than Target → rose error `Saved amount cannot exceed the target.`

### 12.9 Contribute cap
- ☐ Contribute an amount that would push `saved` above `target` → the backend caps `saved` at `target` (progress bar hits 100%, not overflowed).

---

## Section 13 — Debts & payoff planner

**URL:** `/app/debts`

### 13.1 Empty state
- ☐ Stat cards at `0`
- ☐ Empty state card: "No debts yet — Add a credit card, loan or any borrowing"

### 13.2 Add a debt
- ☐ Click **Add debt**
- ☐ Name: `Credit Card`
- ☐ Creditor: `HDFC Bank`
- ☐ Balance: `18000`
- ☐ APR: `36`
- ☐ Min payment: `900`
- ☐ Due date: any date
- ☐ Save

### 13.3 Add a second, low-APR debt
- ☐ Add another: `Car loan`, balance `100000`, APR `9.5`, min `4000`

### 13.4 Add a third, mid-APR debt (so strategies diverge)
- ☐ Add another: `Personal loan`, balance `340000`, APR `22`, min `8000`
- ☐ Why three? With only Credit Card (highest APR *and* smallest balance) + Car loan, both strategies attack Credit Card first, then Car loan — the timelines end up identical. Adding a mid-sized third debt breaks that tie so Avalanche vs. Snowball actually diverge.

### 13.5 Payoff planner
- ☐ Once ≥ 1 debt exists, the **Payoff planner** card appears
- ☐ Move the **Extra monthly payment** slider from `0` to `5000` → summary cards (Debt-free in / Est. payoff date / Total interest) update instantly
- ☐ Type a specific number into the input next to the slider → same effect
- ☐ Toggle between **Avalanche** and **Snowball** strategy pills → summary values change between the two (Avalanche should show a lower Total interest with three debts of differing APR/balance rankings).
- ☐ Callout below the chart reads *"Avalanche saves approx. ₹X in interest and ends Y months sooner than snowball"* with a **Switch to avalanche** shortcut link when you're viewing snowball.
- ☐ Delete the third debt → callout falls back to *"Both strategies produce the same result for your current debts"* with an explanation.
- ☐ The line chart animates to show total balance over months.

### 13.6 Edit / Delete
- ☐ Hover a debt card → edit + delete affordances
- ☐ Delete asks for confirmation

---

## Section 14 — Reports

**URL:** `/app/reports`

### 14.1 Tabs
- ☐ Three tabs: **Overview**, **By category**, **Trends**
- ☐ Above the tabs: 4 stat cards (Total income / Total expense / Net savings / Savings rate) — populated from your entered transactions

### 14.2 Overview
- ☐ Bar chart: monthly Income vs. Expense
- ☐ Top vendors list with horizontal bars (from your expense rows)
- ☐ Category share donut + colored legend

### 14.3 By category
- ☐ Horizontal bar chart with each category in its color

### 14.4 Trends
- ☐ Monthly income vs. expense bar chart

### 14.5 Export CSV
- ☐ Click **Export CSV** (top-right) → your browser downloads **two** CSVs: `report-trend-YYYY-MM-DD.csv` and `report-categories-YYYY-MM-DD.csv`
- ☐ Open both and verify data matches what's on screen

---

## Section 15 — Notifications

**URL:** `/app/notifications`

Notifications are **generated live from your real data** by the backend — you don't seed them any more. The generator runs on every fetch and derives rows from budgets, bills, goals, and transaction activity. `read` and `dismissed` state is remembered per-notification across restarts.

### 15.1 Empty state
- ☐ For a fresh user with no data, the page shows the "Nothing here — No unread notifications." empty state.
- ☐ Filter tabs (All / Unread / Budget / Bills / Goals / Insights) render.
- ☐ **Mark all read** button is disabled when unread = 0.
- ☐ Topbar bell icon links to this page — verify by clicking it from any other page.

### 15.2 Auto-generated: Bill due soon (warning)
- ☐ Go to **Recurring & Bills** → Add a bill with due date **today + 3 days** (`autoPost off`).
- ☐ Return to Notifications → a new row appears titled `<bill name> due in 3 days` with an amber **Bill** chip and unread dot.

### 15.3 Auto-generated: Bill overdue (danger)
- ☐ Edit that bill → change due date to **yesterday** → Save.
- ☐ Refresh Notifications → the row now reads `<bill name> is overdue` with a rose **Bill** chip.

### 15.4 Auto-generated: Budget approaching + over
- ☐ Add a budget (Food & Dining, ₹1,000 monthly, alert at 80%).
- ☐ Add an expense of ₹850 in Food & Dining → refresh Notifications → row `Budget alert: Food & Dining` (amber) appears.
- ☐ Add another ₹200 expense → row transitions to `Over budget: Food & Dining` (rose).

### 15.5 Auto-generated: Goal reached (success)
- ☐ Contribute enough on any goal to hit its target → refresh Notifications → row `Goal reached: <name>` (emerald **Goal** chip) appears.

### 15.6 Auto-generated: Inactivity insight
- ☐ If no transactions have been logged in the last 7 days, an **Insight** row appears: `Log your recent expenses` with a cyan chip and the exact day count in the body.

### 15.7 Mark read + dismiss persistence
- ☐ Click ✅ on any generated row → the unread dot disappears and the tab background dims.
- ☐ Restart the backend (`Ctrl+C`, `npm run dev`) → the same row is still marked read (state is persisted separately from the generated content).
- ☐ Click 🗑 on a row → the row disappears.
- ☐ Restart the backend → the row does **not** re-appear even though the underlying condition (e.g. bill overdue) still holds — dismissals stick.
- ☐ If you later resolve the condition (e.g. mark the bill paid), the row is gone naturally on the next fetch.

### 15.8 Mark all read
- ☐ Trigger any 2 unread notifications → click **Mark all read** → unread badge on the sidebar bell goes to 0 and all rows are marked read.

---

## Section 16 — Dashboard customization

**URL:** `/app/dashboard`

### 16.1 Enter edit mode
- ☐ Click **Customize** in the toolbar → button flips to **Done**
- ☐ Every widget shows dashed borders + three controls in the top-right: `1×` (span), 🗑 (delete), ⋮⋮ (drag handle)
- ☐ A dashed "Add a card" tile appears at the end of the grid

### 16.2 Reorder via drag & drop
- ☐ Grab any widget by its card body and drag it over another → target gets a brand ring
- ☐ Drop → widgets reorder; layout persists to localStorage

### 16.3 Change span
- ☐ Click `1×` on a small widget → it becomes `2×` (spans 2 cols)
- ☐ Click again → `3×` (full width). Again → back to `1×`.

### 16.4 Remove a widget
- ☐ Click the trash on a widget → it disappears from the grid

### 16.5 Add a widget
- ☐ Click the dashed "Add a card" tile (or the **Add card** button in the toolbar)
- ☐ Widget library modal opens with 11 widgets — Cash Flow, Financial Health Score, Expenses Structure, Upcoming Bills, Top Goals, Recent Transactions, AI Insight, Balance Trend, Period to Period, Top Vendors, Savings Rate
- ☐ Click **Savings Rate** → widget appears at the end of the grid
- ☐ Click **Balance Trend** → widget appears
- ☐ Click **Period to Period** → widget appears

### 16.6 Reset & exit edit mode
- ☐ Click **Reset** → grid returns to `DEFAULT_LAYOUT`
- ☐ Click **Done** → exit edit mode; layout stays saved
- ☐ Refresh the browser → your last layout is still there (persisted in `localStorage['wallet_dashboard_layout_v1']`)

---

## Section 17 — CSV import & export

### 17.1 Export
- ☐ Go to Transactions
- ☐ Click **Export** → browser downloads `transactions-YYYY-MM-DD.csv`
- ☐ Apply a filter (e.g., Type = Expense) → Export downloads only those rows

### 17.2 Import (make a small CSV first)
- ☐ Create a file `test-import.csv` on your desktop with this content:
  ```csv
  Date,Vendor,Amount,Category,Note
  2026-07-01,Test Merchant A,-450,Food & Dining,Sample expense
  2026-07-02,Test Merchant B,-1200,Shopping,
  2026-07-03,Test Payer,50000,Salary,Monthly payroll
  ```
- ☐ On Transactions, click **Import**
- ☐ Drop the file (or click **Choose CSV**)
- ☐ Modal auto-parses the file, auto-detects the delimiter, and pre-maps columns
- ☐ Verify mapping (Date/Vendor/Amount are required); pick a default Account and default Category
- ☐ Preview shows the first 5 rows
- ☐ Click **Import 3 rows** → success screen: "Imported 3 transactions"
- ☐ Click **Done** → back on Transactions with the 3 new rows

### 17.3 Reports export
- ☐ On Reports, click **Export CSV** → downloads two files (trend + categories)

---

## Section 18 — Multi-currency & live FX

### 18.1 Change primary currency
- ☐ Settings → Preferences → change Currency to `USD`, save → page reloads → all amounts display as `$` with US formatting

### 18.2 Change country
- ☐ Change Country to `Germany` → Currency auto-flips to `EUR`, Timezone to `Europe/Berlin`
- ☐ Save + reload → amounts display as `€`

### 18.3 Live FX for tracked currencies
- ☐ Settings → Preferences → **Your currencies** → **Add currency**
- ☐ Pick `INR` → rate + inverse fetch from a public FX API (no auth) — should show real numbers (e.g. `1 EUR = 92.xx INR`)
- ☐ Click the small **↻** next to Exchange rate in the modal → rate re-fetches
- ☐ Click **Add** → the currency appears in a table row
- ☐ Click **Refresh** in the section header → the table row's rate updates

### 18.4 Reset to your preferred base currency at the end

---

## Section 19 — Theme (light / dark)

- ☐ Click the sun/moon toggle in the Topbar → app instantly flips theme; both light and dark should look polished, with no unreadable text
- ☐ Refresh the browser → your last-picked theme persists (via `localStorage['wallet_theme']`)
- ☐ You can also change theme from Settings → Preferences via the segmented **Light / Dark** control

---

## Section 20 — Security: PIN lock

### 20.1 Set a PIN
- ☐ Settings → Security → **Set PIN**
- ☐ Modal opens: enter a 4–8 digit PIN (e.g., `1234`), click **Continue**
- ☐ Confirm: enter the same PIN, click **Save PIN**
- ☐ The Security section now shows **PIN lock: On** with **Change PIN** and **Remove** and **Lock now**

### 20.2 Lock now
- ☐ Click **Lock now** — page reloads and you land on a full-screen number-pad **PIN unlock** screen
- ☐ Enter the wrong PIN → dots shake and clear, error line shows "Wrong PIN — try again"
- ☐ Enter the correct PIN → you're back in the app

### 20.3 Session behavior
- ☐ Close the browser tab and reopen `http://localhost:5173/app/dashboard`
- ☐ The PIN screen appears (session flag cleared)
- ☐ Enter PIN → back into the app

### 20.4 Change / remove
- ☐ Settings → Security → **Change PIN** → asks for current PIN, then new PIN, then confirm
- ☐ **Remove** → confirmation prompt → PIN removed, no more unlock screen on next session

---

## Section 21 — Security: Auto-logout on inactivity

- ☐ Settings → Security → **Automatic sign-out on inactivity** — toggle on (default on)
- ☐ **Idle timeout** dropdown: pick `5 minutes` for testing (or lower via localStorage — see below)
- ☐ Stop touching the mouse and keyboard for the configured time
- ☐ A modal appears: **"Are you still there?"** with a 60-second countdown and a progress bar that shrinks from brand → warning → danger tones
- ☐ Options: **Sign out now** and **Stay signed in**
- ☐ If you do nothing, the countdown hits 0 and you are signed out automatically
- ☐ If you click **Stay signed in**, the timer restarts and the modal closes
- ☐ Turn the toggle **off** and confirm the modal no longer appears

**Faster testing (optional):** open DevTools → Console →
```js
JSON.parse(localStorage.getItem('wallet_prefs_v1'))
```
to inspect. The idle timer is clamped to a 60-second minimum internally — you can't test with less than 60 s from the UI, but the countdown is short enough to be usable.

---

## Section 22 — Data at rest is encrypted

### 22.1 Verify the file is encrypted
- ☐ Open `backend/sampledata.json` in an editor
- ☐ It should look like:
  ```json
  { "v": 1, "algorithm": "aes-256-gcm", "iv": "…", "tag": "…", "data": "…" }
  ```
  All actual data is opaque hex — not readable as plain text.

### 22.2 Verify a `.data-key` exists
- ☐ Check that `backend/.data-key` exists (auto-generated on first boot).
- ☐ Verify it's excluded from git (check `.gitignore`).

### 22.3 Migration test (optional)
- ☐ Stop the backend
- ☐ Overwrite `backend/sampledata.json` with a plaintext JSON structure (e.g. paste the empty-state template shown earlier)
- ☐ Delete the `backend/.data-key`
- ☐ Start the backend — you should see:
  ```
  [crypto] backend/.data-key (generated)
  [crypto] migrating sampledata.json from plaintext → encrypted at rest.
  ```
- ☐ Open the file — it's now the envelope again.

---

## Sign-off

Total sections: **22**.

- ☐ Every checkbox above ticked or explicitly skipped (with reason)
- ☐ No console errors during any of the tests (open DevTools → Console)
- ☐ Neither light nor dark theme has unreadable / clipped elements
- ☐ Every page reachable from the sidebar loads without a crash
- ☐ **New transaction** button in the Topbar works from any page

If any test failed, please note the section number + step + observed behavior when reporting back — that makes debugging fastest.

---

## Known gaps (fine for now — will be added later)

- **Goals**: `New goal` UI button exists but backend has no `POST /api/goals` yet. Contribute + list work fine. Seed via `sampledata.json` for now.
- **PDF export**: only CSV export is wired.
- **Push / email notifications**: the notification data model exists and the UI center works, but no delivery mechanism.
- **Split transactions**: not yet supported (one expense across multiple categories).
- **Real bank sync**: not implemented; would require a paid aggregator (Plaid / Salt Edge / Sahamati).
- **Mobile app**: web only for now.
- **Two-factor auth / biometrics**: toggles are UI stubs; not wired end-to-end.

### Recently *closed* gaps

- ~~**Bills**: create-bill UI button exists but backend has no `POST /api/bills`.~~ ✅ Fully implemented — see Section 11.
- ~~**Real password hashing**: the demo backend accepts any credentials.~~ ✅ Passwords are now hashed via Node `scrypt` with per-user salt + timing-safe compare.
- ~~**Auth**: no real per-user data isolation.~~ ✅ Multi-user backend + auth middleware + per-user data + session tokens (persisted across restarts).
- ~~**Insight widget**: "AI insight — dining down 22%" is hardcoded.~~ ✅ Computed from real month-over-month expense delta / top category / income-only fallback.
- ~~**Live analytics**: `spendingTrend`, `categorySpend`, `budget.spent` are static.~~ ✅ Backend recomputes these from actual transactions on every request.
- ~~**Sub-categories**: backend drops `parentId`.~~ ✅ Accepted + validated on POST/PATCH.
- ~~**Sidebar badges**: hardcoded numbers.~~ ✅ Live-fetched counts (Accounts, Transactions, Bills pending, Notifications unread).


