# Personal Finance Dashboard — Requirements Spec

## Goal
A dashboard that shows real financial standing at a glance, backs every AI claim with traceable data, and lets the user customize their own layout (add/remove/resize/reorder widgets).

---

## 1. Top Bar (Global)

| Element | Behavior |
|---|---|
| Breadcrumb (`Workspace / Dashboard`) | Static navigation context |
| Page title + subtitle | "Dashboard" / "Your financial pulse at a glance" |
| Theme toggle | Light/dark switch |
| Notifications bell | Badge count for unread alerts (bills due, anomalies, budget breaches) |
| **+ New transaction** | Primary CTA — opens quick-add modal (amount, category, account, date, note) |
| User profile chip | Name + plan tier (Free/Pro), click → account settings |

---

## 2. Account Cards Row (Keep — this is the strongest part)

**Why it works:** immediate, scannable, color-coded by account type, shows bank/purpose label.

**Requirements to formalize:**
- Each card: `account name`, `balance`, `bank/institution`, `account type tag` (Bank/Savings/Goal), colored dot + gradient by category
- Cards are **horizontally scrollable** if more than 5 accounts
- **+ Add account** card always pinned last
- Click a card → drill into that account's transaction history
- Order should be **user-reorderable** (drag to reposition), with a pinned/favorite option so key accounts stay left
- Optional: small trend arrow (↑/↓ vs last month) per card

---

## 3. AI Daily Summary Card

**Current problem:** conclusions with no traceability ("safely move ₹65,300" — based on what?).

**Fix — every line must be:**
1. **Specific** — cite the number and its source (e.g., which transactions, which rule)
2. **Clickable** — tapping a line expands to show the underlying calculation/transactions
3. **Actionable** — has a button where relevant ("Move to savings", "Review transaction", "Set reminder")

Recommended structure per line:
```
[icon] [claim in bold numbers] — [one-line reasoning]  [→ action button]
```
Example:
- "You have ₹2,99,920 available — after ₹16,800 in upcoming bills this month." → `[View bills]`
- "You can move ₹65,300 to savings — your spending is 22% under budget and emergency fund is fully funded (6+ months)." → `[Move now]`
- "No unusual spending this week — largest transaction was ₹9,000 (Family - JKPM), consistent with your recurring pattern." → `[View transactions]`

---

## 4. Widget System (Overview Section)

### Core requirement: fully customizable grid
- **Add card** — opens a picker of available widget types
- **Customize** — enters edit mode:
  - Drag-and-drop reposition (grid snaps to columns)
  - Resize handles (small / medium / large / full-width)
  - Remove widget (X on hover in edit mode)
  - Changes persist per user (saved layout)
- Use a standard grid library approach (e.g., 12-column responsive grid, widgets occupy 3/6/9/12 units)
- Provide a **"Reset to default layout"** option

### Recommended default widget priority (highest value first)

| Priority | Widget | Why |
|---|---|---|
| 1 | **Account Cards** | Already strong — keep as pinned top row, not a removable widget |
| 2 | **AI Daily Summary** | Actionable insights front and center |
| 3 | **Cash Flow (This Month vs Last Month vs Avg)** | Trend > single snapshot |
| 4 | **Upcoming Bills** (tied to available balance) | Prevents overdraft surprises |
| 5 | **Expense Structure (category breakdown)** | Where the money actually goes |
| 6 | **Budget Adherence per category** | "₹15,117 of ₹18,000 spent" — remaining headroom, not just totals |
| 7 | **Financial Health Score** | Keep, but make each sub-metric clickable to see *why* |
| 8 | **Anomaly / Unusual Transactions** | Flag with specific transaction + reason, not just "all clear" |
| 9 | **Top Vendors / Categories** | Separate "vendors" from "categories" — don't mix Car Loan with Rent |
| 10 | **Recurring vs One-off spend** | Helps distinguish fixed obligations from discretionary spend |
| 11 | **Net worth / Savings trend over time** | Long-term trajectory, not one-liner |
| 12 | **Recent Transactions** | Quick log, filterable |

### Widget picker categories (for "+ Add card")
- Spending & Budgets
- Cash Flow & Trends
- Bills & Reminders
- Goals & Savings
- Insights & Health Score
- Accounts & Vendors

---

## 5. Traceability Principle (apply everywhere)

Every number shown anywhere in the dashboard should support:
- **Hover/click → show source transactions or formula**
- No "black box" scores — Financial Health Score sub-factors (Budget Adherence, Savings Rate, Debt Load, Emergency Fund) should each expand into: what it measures, how it's calculated, and what would improve it

---

## 6. Data Correctness Fixes (from current version)

- Fix mismatched labels: "Top Vendors" chart currently shows a mix of loan types and categories (Car Loan, Rent) alongside actual vendors (Family - JKPM) — split into **Top Categories** and **Top Payees** as separate widgets
- Cash Flow chart needs a **visible legend** (Income / Expense / Investment / Protection) with distinct colors and a toggle to isolate one line
- All monetary widgets should support a **date range selector** (This month / Last month / Custom / YTD)

---

## 7. Customization & Personalization Settings

- Drag handle appears on widget hover (not always visible — keeps default view clean)
- Widget-level settings icon (e.g., pie chart vs bar chart toggle, date range override per widget)
- Layout saved per user, synced across devices
- Support at least 2 saved layout presets (e.g., "Simple view" vs "Detailed view")

---

## Summary of what to build first (MVP order)
1. Account cards row (keep, add reorder + drill-in)
2. AI Summary with clickable/traceable insights
3. Draggable/resizable widget grid framework
4. Cash Flow with legend + comparison periods
5. Upcoming Bills tied to available balance
6. Expense Structure + Budget Adherence
7. Anomaly detection with specific transaction citations
8. Widget picker + layout persistence
