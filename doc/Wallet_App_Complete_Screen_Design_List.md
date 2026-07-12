# WALLET APP - COMPLETE SCREEN DESIGN LIST
## All Screens for Web & Mobile Applications

**Document Type:** Design Specification  
**Created:** July 2, 2026  
**Total Screens:** 35+ unique screens

---

# 🎨 DESIGN OVERVIEW

## **Web App Screens: 20+**
## **Mobile App Screens: 18+**
## **Shared Components: Used in both**

---

# 📱 MOBILE APP SCREENS (18+ Screens)

## **Navigation Structure**
```
Bottom Tab Navigation (5 tabs):
├─ Dashboard (Home)
├─ Transactions
├─ Budgets
├─ Goals
└─ Profile/Settings
```

---

## **TAB 1: DASHBOARD (Home)**

### **1. Dashboard - Main Screen** ⭐
```
Components:
├─ Header
│  ├─ App logo/name
│  ├─ Date range selector (Today/Week/Month)
│  └─ Settings icon

├─ Quick Stats Card
│  ├─ Total Spent (big number)
│  ├─ Budget Remaining (big number)
│  ├─ Color coded (green/red)
│  └─ Percentage used

├─ Budget Progress Bar
│  ├─ Visual bar (filled %)
│  ├─ "₹5,000 of ₹10,000 spent"
│  └─ Alert indicator (if > 80%)

├─ Spending Chart
│  ├─ Pie chart (by category)
│  ├─ Top 3 categories highlighted
│  ├─ Tap to see more
│  └─ Legend on bottom

├─ Upcoming Bills (Card)
│  ├─ Bill name
│  ├─ Amount
│  ├─ Due date (X days left)
│  ├─ Status badge (Paid/Pending)
│  └─ "See all" link

├─ Recent Transactions (List)
│  ├─ Category icon
│  ├─ Transaction name
│  ├─ Amount (red/green)
│  ├─ Date
│  └─ Tap to view details

└─ Floating Action Button (FAB)
   ├─ "+" button (primary color)
   ├─ Opens Quick Add Menu
   └─ Sticky (always visible)

Design Notes:
- White/Dark background (theme-aware)
- Clear visual hierarchy
- Scrollable content
- Responsive padding
- Smooth animations
```

**Wireframe Layout:**
```
┌──────────────────────────┐
│ [Logo]  Date  [Settings] │
├──────────────────────────┤
│  Total Spent: ₹5,000     │
│  Budget Left: ₹5,000     │
├──────────────────────────┤
│  Budget Progress (80%)   │
│  ████████░░ 80%         │
├──────────────────────────┤
│    Spending by Category  │
│        [Pie Chart]       │
├──────────────────────────┤
│  Upcoming Bills:         │
│  • Rent: ₹20k (7 days)  │
│  • Netflix: ₹499 (2 days)│
├──────────────────────────┤
│  Recent Transactions:    │
│  • Groceries: -₹1,200   │
│  • Salary: +₹50,000     │
│  [See All]              │
├──────────────────────────┤
│           [+]            │  ← FAB
└──────────────────────────┘
```

---

### **2. Quick Add Menu** (Popup)
```
Appears when FAB (+) is tapped

Options:
├─ [Camera Icon] Add Transaction by Receipt (OCR)
├─ [Keyboard Icon] Manual Entry
├─ [Document Icon] Upload Bank Statement
└─ [Bill Icon] Add Bill

Design:
- Bottom sheet (slide up from bottom)
- Semi-transparent overlay
- 4-5 large tap targets
- Icons + text
- Close when tapped outside
```

---

### **3. Add Transaction - Manual Entry** (Modal/Screen)
```
Fields:
├─ Amount (number input)
│  └─ Keyboard: numeric with decimal
│  
├─ Category (dropdown/selector)
│  ├─ Icon + category name
│  ├─ Search if too many
│  └─ Or create new

├─ Description/Vendor (text input)
│  └─ Optional

├─ Date Picker
│  ├─ Default: today
│  ├─ Tap to select different date
│  └─ Calendar view

├─ Payment Method (dropdown)
│  ├─ Cash
│  ├─ Debit Card
│  ├─ Credit Card
│  ├─ UPI/Mobile Payment
│  └─ Bank Transfer

├─ Tags (optional)
│  ├─ Add custom tags
│  ├─ Or select existing
│  └─ Search filter

├─ Attach Photo (optional)
│  └─ Camera or gallery

└─ Buttons
   ├─ [Save] (primary)
   └─ [Cancel] (secondary)

Design Notes:
- Form validates as user types
- Amount field large (easy to tap)
- Category default to last used
- Smooth keyboard animation
- Clear error messages
```

---

### **4. Add Transaction - Receipt OCR** (Camera + Review)
```
Part 1: Camera Screen
├─ Camera view (full screen)
├─ Frame guide (rectangle overlay)
├─ "Align receipt within frame"
├─ Snap button (bottom center)
├─ Gallery button (bottom left)
└─ Close button (top right)

Part 2: Processing Screen
├─ Loading spinner
└─ "Analyzing receipt..."

Part 3: Review/Edit Screen
├─ Extracted Data:
│  ├─ Amount: ₹1,200 [edit]
│  ├─ Vendor: Starbucks [edit]
│  ├─ Category: Food [edit]
│  ├─ Date: Today [edit]
│  └─ Payment: Cash [edit]
│
├─ Receipt Image (thumbnail)
│  └─ Tap to view full size
│
└─ Buttons
   ├─ [Confirm & Save]
   └─ [Edit Again]

Design Notes:
- OCR should be accurate 90%+ of time
- Easy to edit if OCR gets it wrong
- Show confidence (if low, highlight for review)
- Save both data AND receipt image
```

---

### **5. Transactions List Screen**
```
Header:
├─ Title: "All Transactions"
├─ Filter icon
└─ Search icon (magnifying glass)

Filter/Search Panel (Hidden until tapped):
├─ Date range (From/To)
├─ Category (multi-select)
├─ Payment method (multi-select)
├─ Amount range slider
├─ Tags (multi-select)
├─ Clear filters button
└─ Apply button

Main Content:
├─ Group by Date (if applicable)
│  └─ "Today", "Yesterday", "This Week", etc.
│
├─ Transaction List
│  ├─ For each transaction:
│  │  ├─ Category icon (colored)
│  │  ├─ Vendor name (bold)
│  │  ├─ Amount (green for income, red for expense)
│  │  ├─ Time (if today)
│  │  └─ Tap to view details
│  │
│  └─ Swipe actions (if enabled)
│     ├─ Swipe left: Edit/Delete
│     └─ Swipe right: Archive/Flag

Bottom:
└─ Month summary
   └─ "Showing 45 transactions | ₹12,500 total spent"

Design Notes:
- Infinite scroll or pagination
- Pull to refresh
- Search is fast (real-time)
- Smooth swipe animations
- Visual feedback on tap
```

---

### **6. Transaction Details Screen**
```
Content:
├─ Header
│  ├─ Category icon (large, colored)
│  ├─ Amount (very large, colored)
│  ├─ Vendor name
│  └─ Date & time

├─ Details Card
│  ├─ Category: [Groceries]
│  ├─ Payment: [Cash]
│  ├─ Tags: [#shopping] [#weekly]
│  ├─ Description: [Weekly grocery shopping]
│  └─ ID: [#TXN-12345]

├─ Receipt (if available)
│  ├─ Receipt image thumbnail
│  ├─ Tap to view full size
│  └─ [Download] button

├─ Edit History (optional)
│  └─ "Last edited: 2 hours ago"

└─ Buttons
   ├─ [Edit] (secondary)
   └─ [Delete] (danger/red)

Design Notes:
- Clean, focused design
- Easy to edit
- Delete with confirmation dialog
- Show receipt details if available
```

---

## **TAB 2: BUDGETS**

### **7. Budgets - Main Screen**
```
Header:
├─ Title: "My Budgets"
├─ Month selector (left/right arrows)
└─ [+] Add Budget button

Budget Cards (Grid/List):
For each budget category:
├─ Category name (bold)
├─ Progress bar (visual)
├─ "₹1,200 of ₹2,000"
├─ Percentage (80%)
├─ Color coded (green/yellow/red)
├─ Remaining days (if applicable)
└─ Tap to see details

Summary at Top:
├─ Total Budget: ₹10,000
├─ Total Spent: ₹8,500
├─ Remaining: ₹1,500
└─ Overall progress bar

Sorting Options:
├─ By budget limit (highest first)
├─ By spending (most spent first)
├─ By category (A-Z)
└─ By progress (closest to limit first)

Design Notes:
- Cards easily scannable
- Color-coded at a glance
- Alerts for budgets > 80%
- Smooth transitions
```

---

### **8. Budget Details Screen**
```
Header:
├─ Category name & icon
├─ Budget limit: ₹2,000
└─ Month selector

Progress:
├─ Large progress circle
├─ "₹1,200 of ₹2,000 (60%)"
└─ Days remaining (if applicable)

Charts:
├─ Line chart (spending over time)
│  └─ Shows daily spend
│
├─ Category breakdown
│  └─ How this budget breaks down

Recent Transactions:
├─ Transactions in this category
├─ Scroll to see more
└─ Tap to view details

Actions:
├─ [Edit Budget]
├─ [Delete Budget]
└─ [View All Transactions in Category]

Alerts (if applicable):
├─ "⚠️ 80% of budget used"
└─ "✅ On track to stay within budget"

Design Notes:
- Visual progress is prominent
- Easy to see spending trends
- Quick access to edit
- Alert system clear
```

---

### **9. Add/Edit Budget Screen**
```
Form Fields:
├─ Category selector
│  ├─ Icon + name
│  └─ Can't change after creation

├─ Budget amount (number input)
│  └─ Currency selector

├─ Period selector
│  ├─ Monthly (default)
│  ├─ Weekly
│  ├─ Yearly
│  └─ Custom

├─ Alert thresholds (optional)
│  ├─ Alert at 50% spent
│  ├─ Alert at 75% spent
│  ├─ Alert at 100% spent
│  └─ Toggles for each

├─ Notes/Description (optional)
│  └─ Why this budget exists

└─ Buttons
   ├─ [Save Budget]
   └─ [Cancel]

Design Notes:
- Simple, clean form
- Validation (prevents invalid amounts)
- Helpful hints
- Pre-filled if editing
```

---

## **TAB 3: SAVINGS GOALS**

### **10. Savings Goals - Main Screen**
```
Overview Card (Top):
├─ Total Goals: 5
├─ Total Target: ₹5,00,000
├─ Total Saved: ₹1,50,000
├─ Progress: 30%
└─ "Highest priority" summary — data-driven
   └─ Sorted by priority rank (high>medium>low), then completion %
   └─ Renders "No goals yet" when the list is empty

Goal Cards (List):
For each goal:
├─ Goal name (e.g., "Vacation")
├─ Goal icon
├─ Target amount
├─ Current amount
├─ Progress bar (visual)
├─ "₹50k of ₹1,00,000"
├─ Percentage (50%)
├─ Deadline or "No deadline"
├─ Hover reveals ✏️ Edit and 🗑 Delete affordances
└─ Tap to see details / Contribute

Sorting:
├─ By priority
├─ By target amount
├─ By deadline
└─ By progress

Actions:
├─ [+] Add New Goal (button)
├─ [Empty State] "Add your first goal" CTA
├─ Edit / Delete (from hover on card)
└─ Contribute (opens themed ContributeModal — see §12 below)

Deep links:
├─ ?add=1               → opens the create modal on navigation
└─ ?contribute=<id>     → opens the Contribute modal on that goal

Design Notes:
- Motivational design
- Visual progress bars
- Color-coded by priority
- Empty state with an inviting CTA
- Delete is guarded by a themed confirmation modal
```

---

### **11. Savings Goal Details Screen**
```
Header:
├─ Goal name (e.g., "Dream Vacation")
├─ Goal icon (large)
└─ Target/Deadline info

Progress:
├─ Large circular progress (%)
├─ "₹50,000 of ₹1,00,000 saved"
├─ Days until deadline (if set)
└─ "On track!" / "Need to save ₹X/month"

Breakdown:
├─ Target amount: ₹1,00,000
├─ Current saved: ₹50,000
├─ Still needed: ₹50,000
├─ Monthly allocation: ₹5,000
├─ Deadline: Dec 31, 2024
└─ Category: Travel

Savings Contributions:
├─ List of auto-allocations
├─ Or manual contributions
└─ Contribution history (timeline)

Milestones (if applicable):
├─ 25% - Celebrate milestone
├─ 50% - Celebrate milestone
├─ 75% - Celebrate milestone
├─ 100% - Goal reached! 🎉

Actions:
├─ [Add Money to Goal]
├─ [Edit Goal]
└─ [Delete Goal]

Design Notes:
- Motivational messaging
- Progress is visual and emotional
- Celebrate milestones
- Easy to contribute
```

---

### **12. Add/Edit Savings Goal Screen (GoalModal)**
```
Form Fields:
├─ Goal name (text input, required)
│  └─ E.g., "Summer Vacation", "New Car"

├─ Target amount (number input, required, must be > 0)
│  └─ Currency selector

├─ Saved so far (number input)
│  └─ Must be ≤ target (validated)

├─ Target date (date picker, optional)
│  └─ Shows "X months/days away"

├─ Priority (segmented control)
│  ├─ High
│  ├─ Medium
│  └─ Low

├─ Planned monthly contribution (number input, optional)
│  └─ Used to compute pace / on-track chip

├─ Note (textarea, optional)
│  └─ Why this goal matters

├─ Color picker
│  └─ 10-swatch palette

└─ Buttons
   ├─ [Save Goal] (label reflects create vs. edit)
   └─ [Cancel]

Validation:
- Name required
- Target must be > 0
- Saved must be ≤ target (rose error otherwise)

Behavior:
- Modal reuses the app-wide Modal primitive
  (sticky header + sticky footer, scrollable body, animate-modalIn)
- Delete flows through a separate themed confirmation modal

Design Notes:
- Themed, consistent with the rest of the app (no browser prompts)
- Color picker keeps card art visually distinct across goals
- Real-time validation with clear inline errors
```

---

### **12a. Contribute to Goal (ContributeModal)**
```
Trigger:
├─ [Contribute] button on any goal card
└─ Deep link ?contribute=<goal_id>

Layout (size='sm' themed modal):

├─ Goal summary card (top)
│  ├─ Icon in the goal's color
│  ├─ Goal name
│  ├─ Saved / Target
│  ├─ Current %
│  └─ Colored progress bar

├─ Amount input (auto-focused)
│  └─ Rose validation error for amount ≤ 0

├─ Quick-add chips
│  ├─ +₹500
│  ├─ +₹1,000
│  ├─ +₹5,000
│  ├─ +₹10,000
│  └─ Max (₹<remaining>)

├─ Live preview panel (renders as user types)
│  ├─ Projected balance
│  ├─ Projected progress bar
│  ├─ Projected %
│  ├─ 🎉 "Target reached" badge if amount hits target
│  └─ Amber warning if amount overshoots
│     ("Only ₹X needed — extra will be ignored.")

├─ If already fully funded:
│  └─ Emerald panel: "You've already hit this goal. Nice work!"

└─ Buttons
   ├─ [Add ₹X] (label updates dynamically; disabled at ₹0)
   │  └─ Reads "Already reached" (disabled) when goal is fully funded
   └─ [Cancel]

Backend:
- POST /api/goals/:id/contribute caps `saved` at `target`

Design Notes:
- Replaces the old window.prompt('Contribute amount (₹)?', ...) dialog
- Themed modal, consistent with the rest of the app
- Live preview turns the "will this hit my goal?" question into an obvious visual
```

---

## **TAB 4: RECURRING & BILLS**

### **13. Recurring & Bills - Main Screen**
```
Header:
├─ Title: "Recurring & Bills"
├─ Month selector
└─ [+] Add Bill button

Notes:
├─ URL: /app/bills
├─ Same page hosts one-off bills and recurring rules
│  (recurring rules are just bills with autoPost: true).
└─ Legacy Settings → Recurring tab has been retired.

Sections:

1. DUE SOON (Red alert)
   ├─ Bills due in next 7 days
   ├─ For each:
   │  ├─ Bill name (bold, red)
   │  ├─ Amount
   │  ├─ Due date (X days left)
   │  ├─ Status: PENDING
   │  └─ Tap to mark paid / details
   └─ [If empty: No bills due soon ✅]

2. UPCOMING (Yellow alert)
   ├─ Bills due 7-30 days away
   ├─ Same layout as above
   └─ [If empty: No upcoming bills]

3. PAID THIS MONTH
   ├─ Collapsed section (expandable)
   ├─ Bills marked as paid
   └─ For each: Name, amount, date paid

4. SUBSCRIPTION TRACKER (Optional)
   ├─ Netflix, Spotify, etc.
   ├─ Monthly cost & renewal date
   └─ Tap to manage

Summary:
├─ "₹50,000 total bills this month"
├─ "₹20,000 already paid"
└─ "₹30,000 still due"

Design Notes:
- Color coding for urgency
- Clear visual hierarchy
- Easy to mark paid
- Notifications/reminders
```

---

### **14. Add/Edit Bill Screen**
```
Form Fields:
├─ Type (segmented control)
│  ├─ Expense (default)
│  └─ Income
│
├─ Bill name / Vendor (text input)
│  └─ E.g., "Rent", "Insurance", "Netflix"

├─ Amount (number input)
│  └─ Currency selector

├─ Category — label (text)
│  └─ Free-text display label (e.g., "Rent", "Utilities")

├─ Category — for posting (categoryId reference)
│  └─ Picker of user categories; used when auto-posting to the ledger

├─ Due date (date picker)
│  └─ Day of month (e.g., "Due on 5th")

├─ Frequency (dropdown)
│  ├─ One-time
│  ├─ Weekly
│  ├─ Monthly (default)
│  └─ Yearly

├─ Paid-from account (dropdown)
│  └─ Selects the account the posted transaction should hit

├─ Payment method (optional)
│  ├─ Bank Transfer
│  ├─ Card / UPI / Cash
│  └─ Other

├─ Note (optional)
│  └─ Account number, memo, etc.

├─ ☐ Auto-post to ledger
│  └─ When enabled, on the due date the backend posts a real
│     transaction and advances dueDate. This replaces the old
│     "recurring rule" concept — auto-post is the mechanism now.
│
├─ ☐ Autopay is set up
│  └─ Cosmetic amber ⚡ chip only. Indicates the user has autopay
│     wired up externally (e.g., biller-side autopay). No automation
│     inside the app is driven by this flag.

└─ Buttons
   ├─ [Save Bill]
   └─ [Cancel]

Card affordances (list view):
├─ 🔄 Auto-post chip when autoPost=true
├─ ⚡ Autopay chip (amber) when autopay=true
├─ Hover: ⚡ Run now (post immediately) · ⏸ Pause · ✏️ Edit · 🗑 Delete
└─ Mark-as-paid button is hidden on auto-post bills
   (the generated transaction is the proof of payment)

Design Notes:
- Clean, straightforward form
- Two independent flags: "Auto-post to ledger" and "Autopay is set up"
- Validation prevents errors
```

---

## **TAB 5: PROFILE & SETTINGS**

### **15. Profile Screen**
```
Header:
├─ Profile picture (large circle)
├─ Edit button
├─ Name (editable)
└─ Email (display only)

Account Info:
├─ Email: user@example.com
├─ Phone: +91-XXXXXXXXXX
├─ Member since: Jan 2024
├─ Account status: Active ✅
└─ [Edit Profile] button

Quick Stats:
├─ Total transactions: 245
├─ Accounts connected: 3
├─ Budgets active: 8
└─ Savings goals: 5

Actions:
├─ [Edit Profile]
├─ [Change Password]
├─ [Two-Factor Authentication]
├─ [Privacy Settings]
└─ [Data & Privacy]

Design Notes:
- Personal, welcoming design
- Easy access to account settings
- Security features highlighted
- Profile picture customizable
```

---

### **16. Settings Screen**
```
Sections:

1. GENERAL
   ├─ [ ] Dark Mode
   ├─ Currency: INR ▼
   ├─ Date format: DD/MM/YYYY ▼
   ├─ Language: English ▼
   └─ Timezone: IST ▼

2. NOTIFICATIONS
   ├─ [ ] Push notifications
   ├─ [ ] Budget alerts
   ├─ [ ] Bill reminders
   ├─ [ ] Weekly summary
   └─ [ ] Daily tips

3. PRIVACY & SECURITY
   ├─ [ ] Biometric login
   ├─ [ ] Require PIN on app open
   ├─ [ ] Logout on inactivity (30 min)
   ├─ [Change Password]
   ├─ [Manage sessions]
   └─ [Export my data]

4. DATA MANAGEMENT
   ├─ [Backup now]
   ├─ [Last backup: Today 2:30 PM]
   ├─ [Delete all transactions]
   ├─ [Delete account] (danger zone - red)
   └─ [Privacy policy]

5. HELP & SUPPORT
   ├─ [Contact support]
   ├─ [FAQ]
   ├─ [Terms of service]
   ├─ [Privacy policy]
   └─ App version: v1.0.0

6. ACCOUNT
   └─ [Log out]

Design Notes:
- Well-organized sections
- Toggles for yes/no options
- Confirmation dialogs for destructive actions
- Help easily accessible
```

---

### **17. Biometric Login Setup**
```
Screen 1: Enable Biometric
├─ Title: "Enable Biometric Login"
├─ Description: "Use Face ID / Fingerprint to quickly access Wallet"
├─ Icon (large, centered)
├─ [Enable Face ID] button
├─ [Enable Fingerprint] button
└─ [Skip] button

Screen 2: Biometric Registration
├─ "Setting up Face ID..."
├─ Camera view (animated)
├─ Instructions: "Look at the camera"
├─ Or: "Place your finger on scanner"
└─ Cancel button

Screen 3: Success
├─ ✅ "Face ID enabled successfully"
├─ "You can now use Face ID to login"
└─ [Done] button

Design Notes:
- Clear instructions
- Visual feedback during setup
- Multiple biometric options
- Easy to skip if not needed
```

---

## **OVERLAY/MODAL SCREENS (Mobile)**

### **18. Budget Alert Modal**
```
When user spends > 80% of budget:

┌──────────────────────┐
│  ⚠️ Budget Alert     │
├──────────────────────┤
│ Groceries Budget     │
│ 85% used            │
│                     │
│ You've spent ₹1,700 │
│ of ₹2,000 budget    │
│                     │
│ Only ₹300 left      │
├──────────────────────┤
│ [Got it] [View]    │
└──────────────────────┘

Design Notes:
- Appears as alert/notification
- Not blocking (can dismiss easily)
- Can see budget details by tapping [View]
```

---

### **19. Goal Milestone Celebration**
```
When goal hits 25%, 50%, 75%, 100%:

┌──────────────────────┐
│      🎉 🎉 🎉        │
│   Milestone Reached! │
├──────────────────────┤
│  You've saved 50% of │
│  your vacation goal! │
│                      │
│  ₹50,000 saved       │
│  Keep it up! 💪     │
├──────────────────────┤
│   [Celebrate!]      │
│   [Share]           │
└──────────────────────┘

Design Notes:
- Celebratory, motivational
- Confetti animation (optional)
- Can share on social media
- Easy to dismiss
```

---

# 💻 WEB APP SCREENS (20+ Screens)

## **Navigation Structure**
```
Top Navigation Bar:
├─ Logo/App name (left)
├─ Navigation links (center):
│  ├─ Dashboard
│  ├─ Transactions
│  ├─ Budgets
│  ├─ Recurring & Bills
│  ├─ Goals
│  ├─ Debts
│  ├─ Reports
│  ├─ Notifications
│  └─ Settings
└─ User menu (right):
   ├─ Profile
   ├─ Help
   └─ Logout

Optional: Left Sidebar (collapsible)
```

---

## **MAIN SCREENS**

### **1. Dashboard - Web** ⭐
```
Layout: 3-column

LEFT COLUMN (25%):
├─ Quick Filters
│  ├─ Date range
│  ├─ Categories
│  └─ Payment methods
│
└─ Mini Charts
   ├─ Top 5 categories (pie)
   ├─ Income vs Expense
   └─ Savings rate

CENTER COLUMN (50%):
├─ Header
│  ├─ Date range selector
│  ├─ Refresh button
│  └─ Export button
│
├─ Key Metrics Cards
│  ├─ Total Spent (card)
│  ├─ Budget Status (card)
│  ├─ Income This Month (card)
│  └─ Savings Rate (card)
│
├─ Budget Progress (visual bar)
│  └─ All categories in one view
│
├─ Spending Trend (line chart)
│  └─ Last 12 months
│
└─ Recent Transactions (table)
   ├─ Columns: Date, Category, Vendor, Amount, Action
   ├─ Sortable & filterable
   ├─ Pagination
   └─ Inline edit/delete

RIGHT COLUMN (25%):
├─ Upcoming Bills
│  ├─ Next 7 days
│  ├─ Due amounts
│  └─ Mark as paid from here
│
├─ Savings Goals Progress
│  ├─ Top 3 goals
│  ├─ Progress bars
│  └─ Link to full list
│
└─ Financial Health Score
   ├─ Score: 78/100
   ├─ Breakdown
   └─ Tips to improve

Design Notes:
- Light, spacious design
- Charts are interactive (hover for details)
- Responsive to different screen sizes
- Sidebar can collapse for more space
- Dark mode support
```

**Desktop Wireframe:**
```
┌─────────────────────────────────────────────────────┐
│ Logo    Dashboard  Trans  Budgets  Goals  Reports    │
├──────────────────────────────────────────────────────┤
│ Filters │  Total Spent: ₹8,500        │ Bills Due │
│  Date   │  Budget Left: ₹1,500        │ Rent:₹20k│
│ Filter  │  Budget: ████████░░ 80%     │ Date: 5d │
│  By Cat │                              │  Goals   │
│         │  Spending Trend (Line Chart) │ Vacation │
│         │  [12-month graph]            │ 50% done │
│         │                              │          │
│         │  Recent Transactions         │ Score: 78│
│         │  ┌──────────────────────┐   │ /100     │
│         │  │Date │Cat │Vendor│Amt│   │          │
│         │  ├──────────────────────┤   │          │
│         │  │ Today│Groc│Mart │-500│   │          │
│         │  │ Yest │Food│Cafe │-200│   │          │
│         │  └──────────────────────┘   │          │
└──────────────────────────────────────────────────────┘
```

---

### **2. Transactions - Web**
```
Header:
├─ Title: "All Transactions"
├─ Date range selector
├─ Add transaction button (+)
└─ Export button

Filters (Left sidebar or top):
├─ Search box (real-time)
├─ Category (multi-select)
├─ Payment method (multi-select)
├─ Date range (from/to)
├─ Amount range (slider)
├─ Tags (multi-select)
├─ Status (All/Pending/Completed)
└─ Apply filters button

Main Table:
├─ Columns (sortable by clicking):
│  ├─ Date
│  ├─ Category (with icon)
│  ├─ Vendor/Description
│  ├─ Payment Method
│  ├─ Amount (colored)
│  └─ Actions (Edit, Delete)
│
├─ Rows (clickable):
│  ├─ Highlight on hover
│  ├─ Click to see full details
│  └─ Checkbox for bulk actions
│
└─ Pagination
   ├─ 10/25/50 rows per page
   ├─ Page numbers
   └─ Next/Previous buttons

Bulk Actions (if rows selected):
├─ Delete selected
├─ Change category
├─ Add tag
└─ Export selected

Design Notes:
- Table is scrollable horizontally (mobile)
- Real-time search
- Sorting by clicking column headers
- Filters are persistent
- CSV/PDF export option
```

---

### **3. Add/Edit Transaction - Web (Modal or Page)**
```
Form Layout: Two-column

LEFT COLUMN:
├─ Amount (large input field)
├─ Currency selector
└─ Transaction type (Income/Expense)

RIGHT COLUMN:
├─ Category (dropdown + search)
├─ Payment method (dropdown)
└─ Date picker (calendar)

FULL WIDTH:
├─ Vendor/Description (text input)
├─ Tags (multi-select input)
├─ Notes (textarea)
└─ Receipt upload (drag-drop area)

BOTTOM:
├─ [Save Transaction] button
├─ [Save and Add Another] button
└─ [Cancel] button

Design Notes:
- Validation in real-time
- Auto-save draft (optional)
- Show summary before save
- Quick category selection (recent used)
```

---

### **4. Budgets - Web**
```
Header:
├─ Title: "Budgets"
├─ Month/Period selector
└─ Add budget button

View Options:
├─ Grid view (default)
├─ List view
└─ Summary view

GRID VIEW:
├─ Cards for each category
├─ Category name & icon
├─ Progress bar (visual)
├─ "₹1,200 of ₹2,000"
├─ Remaining days
├─ Click to see details
└─ Hover: Edit/Delete options

LIST VIEW:
├─ Table format
├─ Category | Limit | Spent | Remaining | % Used | Actions
├─ Sortable columns
└─ Pagination

Summary at Top:
├─ Total Budget: ₹10,000
├─ Total Spent: ₹8,500
├─ Remaining: ₹1,500
├─ Overall progress bar
└─ Alerts if any budget > 80%

Design Notes:
- Toggle between views
- Color-coded by status
- Quick edit without opening modal
- Alerts for overspending
```

---

### **5. Budget Details - Web**
```
Header:
├─ Category name & icon
├─ Budget limit
├─ Period
└─ Edit/Delete buttons

Main Content:

LEFT SECTION (60%):
├─ Large progress bar (circular or linear)
├─ "₹1,200 of ₹2,000 (60%)"
├─ "₹800 remaining"
│
├─ Charts:
│  ├─ Spending trend (line chart)
│  ├─ Daily breakdown (bar chart)
│  └─ Category breakdown (pie chart)

RIGHT SECTION (40%):
├─ Budget details:
│  ├─ Budget limit: ₹2,000
│  ├─ Current spent: ₹1,200
│  ├─ Remaining: ₹800
│  ├─ Days remaining: 15 days
│  ├─ Daily average: ₹80
│  └─ Pace check: "On track"
│
└─ Alerts:
   ├─ 80% threshold: ⚠️ Alert
   └─ 100% threshold: ✅ Ok

Transactions in this budget:
├─ Table of recent transactions
├─ Category breakdown by vendor
└─ Click to see transaction details

Design Notes:
- Data visualization is key
- Trend analysis important
- Detailed breakdown helpful
- Alerts prominently displayed
```

---

### **6. Recurring & Bills - Web**
```
Header:
├─ Title: "Recurring & Bills"
├─ Month selector
└─ Add bill button

Notes:
├─ URL: /app/bills
├─ Recurring rules are just bills with autoPost: true — no separate page.
└─ Auto-post rows render a 🔄 Auto-post chip and expose ⚡ Run now / ⏸ Pause hover actions.

View Options:
├─ Calendar view (default - shows due dates)
├─ List view
└─ Timeline view

CALENDAR VIEW:
├─ Month calendar
├─ Bills shown on due dates
├─ Color coded: Red (due soon), Yellow (upcoming), Green (paid)
├─ Click date to see bills
└─ Drag to reschedule (optional)

LIST VIEW:
├─ Table format:
│  ├─ Bill name
│  ├─ Amount
│  ├─ Due date
│  ├─ Status (Paid/Pending)
│  ├─ Frequency
│  └─ Actions
│
├─ Grouped by:
│  ├─ Due soon (red)
│  ├─ Upcoming (yellow)
│  └─ Paid this month (gray)

Summary:
├─ Total bills this month: ₹50,000
├─ Paid: ₹20,000
├─ Pending: ₹30,000
└─ Bar chart showing distribution

Design Notes:
- Multiple views for flexibility
- Visual urgency indicators
- Easy to mark as paid
- Recurring bills clearly marked
- Quick edit/delete options
```

---

### **7. Savings Goals - Web**
```
Header:
├─ Title: "Savings Goals"
└─ Add goal button

Goals Grid:
├─ For each goal (card or row):
│  ├─ Goal name & icon
│  ├─ Target amount
│  ├─ Current saved
│  ├─ Progress bar (%)
│  ├─ Days until deadline
│  ├─ "On track" / "Need ₹X/month"
│  └─ Click for details

Summary:
├─ Total goals: 5
├─ Total target: ₹5,00,000
├─ Total saved: ₹1,50,000
├─ Overall progress: 30%
└─ Aggregate progress bar

Sorting/Filtering:
├─ By target amount
├─ By deadline
├─ By priority
└─ By progress

Design Notes:
- Motivational design
- Visual progress is key
- Milestones are celebrated
- Easy to contribute to goals
```

---

### **8. Goal Details - Web**
```
Header:
├─ Goal name & icon (large)
├─ Target amount
├─ Target date
└─ Edit/Delete buttons

Main Content:

LEFT SECTION (60%):
├─ Large progress circle
├─ "₹50,000 of ₹1,00,000 (50%)"
│
├─ Savings chart:
│  ├─ Monthly contribution trend (bar chart)
│  ├─ Savings progress over time (line chart)
│  └─ On-pace indicator
│
└─ Milestones:
   ├─ 25%: ✅ Completed
   ├─ 50%: ✅ Completed
   ├─ 75%: ⭕ In progress
   └─ 100%: ⭕ Not started

RIGHT SECTION (40%):
├─ Goal summary:
│  ├─ Target: ₹1,00,000
│  ├─ Saved: ₹50,000
│  ├─ Needed: ₹50,000
│  ├─ Deadline: Dec 31, 2024
│  ├─ Days left: 180 days
│  ├─ Monthly need: ₹5,556
│  └─ Current pace: ₹5,000/month
│
└─ Actions:
   ├─ [Add funds]
   ├─ [Edit goal]
   └─ [Delete goal]

Contributions Table:
├─ When funds were added
├─ How much
├─ From where (auto-save, manual, etc.)
└─ Running total

Design Notes:
- Progress visualization critical
- Show pace/timeline analysis
- Motivational messaging
- Easy to add funds
```

---

### **9. Reports - Web**
```
Header:
├─ Title: "Reports & Insights"
├─ Date range selector (From/To)
└─ Export button (PDF/CSV/Excel)

Report Options (Tabs):
├─ Overview
├─ By Category
├─ By Payment Method
├─ Trends
├─ Savings
└─ Debt

OVERVIEW TAB:
├─ Summary cards:
│  ├─ Total income
│  ├─ Total expense
│  ├─ Net savings
│  └─ Savings rate (%)
│
├─ Income vs Expense chart
├─ Category breakdown (pie chart)
├─ Top merchants (bar chart)
└─ Monthly summary table

BY CATEGORY TAB:
├─ Detailed breakdown:
│  ├─ Category name
│  ├─ Amount
│  ├─ % of total
│  ├─ vs last month
│  └─ vs last year
│
├─ Charts:
│  ├─ Category trends over time
│  └─ Category comparison (pie)

TRENDS TAB:
├─ Daily spending (line chart)
├─ Weekly spending (bar chart)
├─ Monthly spending (line chart)
├─ Yearly comparison
└─ Spending velocity (how fast spending increases)

SAVINGS TAB:
├─ Savings goals progress
├─ Savings rate over time
├─ Projected savings
└─ Goals on track / off track

Design Notes:
- Multiple perspectives on data
- Charts are interactive (hover for details)
- Comparison with previous periods
- Export functionality
- Customizable date ranges
```

---

### **9a. Notifications Center - Web**
```
Header:
├─ Title: "Notifications"
├─ Unread counter
└─ [Mark all read]

Filter tabs:
├─ All
├─ Unread (with count badge)
├─ Budget
├─ Bills
├─ Goals
└─ Insights

Notification list (sorted danger → warning → success → info):
For each row:
├─ Type icon (bill / budget / goal / insight)
├─ Title
├─ Body
├─ Colored tone chip
│  ├─ danger  → red    (Bill overdue, Over budget)
│  ├─ warning → amber  (Bill due soon, Budget alert)
│  ├─ success → emerald (Goal reached)
│  └─ info    → cyan   (Inactivity insight)
├─ Dot for unread
└─ Hover reveals [Mark read] and [Dismiss]

Source of rows:
├─ Auto-derived from live user data via
│  generateNotificationsFor(userData) on every read.
├─ Each derived row has a deterministic id (gen_<kind>_<sourceId>)
│  so re-runs don't duplicate.
├─ userData.notifications persists an overlay
│  { id, read?, dismissed? } so read state and dismissals survive
│  backend restarts.
└─ Legacy hand-seeded rows (id NOT starting with gen_) still render.

Generator triggers:
├─ Bill overdue    — pending bill with dueDate < today
├─ Bill due soon   — pending bill with dueDate ≤ today + 5 days
├─ Over budget     — budget where spent ≥ limit
├─ Budget alert    — budget where spent ≥ alertAt%
├─ Goal reached    — goal where saved ≥ target
└─ Inactivity      — latest transaction ≥ 7 days old

API surface (unchanged):
├─ GET /api/notifications
├─ PATCH /api/notifications/:id  (mark read)
├─ DELETE /api/notifications/:id (dismiss)
└─ POST /api/notifications/read-all

Design Notes:
- The Notifications page has replaced the previous "hand-seed rows in sampledata.json" model.
- The frontend respects the server-provided `tone` field so two rows with the same `type: 'bill'` can render red (overdue) vs amber (due soon).
```

---

### **10. Settings - Web**
```
Layout: Two-column

LEFT COLUMN (Navigation):
├─ Account
├─ General
├─ Notifications
├─ Privacy & Security
├─ Data & Backups
└─ Help & Support

RIGHT COLUMN (Content):

ACCOUNT SECTION:
├─ Profile picture
├─ Name
├─ Email
├─ Phone
├─ Change password
├─ Delete account (danger zone)

GENERAL SECTION:
├─ Theme (Light/Dark/Auto)
├─ Language (dropdown)
├─ Currency (dropdown)
├─ Date format (dropdown)
├─ Timezone (dropdown)
└─ Time format (12h/24h)

NOTIFICATIONS SECTION:
├─ Email notifications (toggles):
│  ├─ Budget alerts
│  ├─ Bill reminders
│  ├─ Weekly summary
│  └─ Promotional (optional)
│
├─ In-app notifications (toggles):
│  ├─ Budget alerts
│  ├─ Goal milestones
│  └─ Spending insights
│
└─ Frequency selector

PRIVACY & SECURITY SECTION:
├─ Two-factor authentication (toggle)
├─ Login sessions (list + logout all)
├─ API tokens (manage)
├─ Connected apps (list)
└─ Privacy policy & Terms

DATA & BACKUPS SECTION:
├─ Backup now (button)
├─ Last backup: (timestamp)
├─ Auto-backup frequency (dropdown)
├─ Export data (CSV/JSON)
├─ Data deletion (warning)
└─ GDPR compliance

Design Notes:
- Organized sections
- Clear settings hierarchy
- Confirmation dialogs for destructive actions
- Help text for complex settings
```

---

## **SHARED/OVERLAY SCREENS (Both Web & Mobile)**

### **20. Confirmation Dialogs**
```
Delete Transaction:
┌──────────────────────────┐
│ Delete Transaction?      │
├──────────────────────────┤
│ Are you sure? This       │
│ cannot be undone.        │
│                          │
│ Groceries - ₹500         │
│                          │
│ [Cancel]  [Delete]       │
└──────────────────────────┘

Delete Budget:
┌──────────────────────────┐
│ Delete Groceries Budget? │
├──────────────────────────┤
│ This will remove the     │
│ budget but not delete    │
│ the transactions.        │
│                          │
│ [Cancel]  [Delete]       │
└──────────────────────────┘

Design Notes:
- Red/danger styling for delete
- Confirmation required
- Clear consequences explained
```

---

### **21. Error Messages**
```
Invalid Amount:
┌──────────────────────────┐
│ ❌ Invalid Amount         │
├──────────────────────────┤
│ Please enter a valid     │
│ amount greater than 0    │
│                          │
│         [OK]             │
└──────────────────────────┘

Network Error:
┌──────────────────────────┐
│ ⚠️ Network Error          │
├──────────────────────────┤
│ Unable to sync data.     │
│ Check your connection.   │
│                          │
│  [Retry]  [Offline OK]   │
└──────────────────────────┘

Design Notes:
- Clear error messages
- Helpful suggestions
- Action buttons to resolve
- Icon + text for clarity
```

---

### **22. Loading States**
```
Spinner:
┌──────────────────────────┐
│      Loading...          │
│       ⌛ ↻ ↙            │
│                          │
│   Processing your data   │
└──────────────────────────┘

Skeleton Loading:
┌──────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  ▓░░░░░░░░░░░░░░░░░░  │
│  ▓░░░░░░░░░░░░░░░░░░  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
└──────────────────────────┘

Design Notes:
- Smooth animations
- Show progress if possible
- Skeleton for table/list loading
- Prevents layout shift
```

---

### **23. Empty States**
```
No Transactions:
┌──────────────────────────┐
│      📄 No Data          │
├──────────────────────────┤
│ You haven't added any    │
│ transactions yet.        │
│                          │
│ [+ Add Transaction]      │
└──────────────────────────┘

No Budgets:
┌──────────────────────────┐
│      💰 No Budgets       │
├──────────────────────────┤
│ Create your first budget │
│ to start tracking        │
│ spending.                │
│                          │
│ [+ Create Budget]        │
└──────────────────────────┘

Design Notes:
- Illustration/icon
- Helpful messaging
- Call-to-action button
- Encourages engagement
```

---

# 📋 COMPLETE SCREEN CHECKLIST

## **Mobile App - 18 Screens**
```
Authentication & Onboarding:
[ ] Splash screen
[ ] Login/Signup screen
[ ] Password reset
[ ] Biometric setup (optional)

Dashboard & Home:
[ ] Dashboard - Main screen
[ ] Quick add menu
[ ] Recent transactions widget

Transactions:
[ ] Add transaction (manual)
[ ] Add transaction (OCR camera)
[ ] OCR review/edit
[ ] Transactions list
[ ] Transaction details
[ ] Filter/search panel

Budgets:
[ ] Budgets main screen
[ ] Budget details
[ ] Add/Edit budget

Recurring & Bills:
[ ] Recurring & Bills main screen (single page, URL /app/bills)
[ ] Add/Edit bill (with Auto-post and Autopay checkboxes)
[ ] Bill details

Savings Goals:
[ ] Goals main screen (with data-driven "Highest priority" panel)
[ ] Goal details
[ ] Add/Edit goal (GoalModal with 10-swatch color picker)
[ ] Contribute (ContributeModal with live preview)
[ ] Delete confirmation modal

Profile & Settings:
[ ] Profile screen
[ ] Settings screen
[ ] Biometric login setup

Overlays & Modals:
[ ] Budget alert modal
[ ] Goal milestone celebration
[ ] Confirmation dialogs
[ ] Error messages
[ ] Loading states
[ ] Empty states
```

## **Web App - 20+ Screens**
```
Navigation & Layout:
[ ] Top navigation bar
[ ] Sidebar navigation
[ ] Mobile responsive nav

Main Pages:
[ ] Dashboard - Web
[ ] Transactions list - Web
[ ] Add/Edit transaction - Web
[ ] Budgets overview
[ ] Budget details
[ ] Recurring & Bills — list view (single page)
[ ] Savings goals overview (with data-driven Highest priority panel)
[ ] Goal details
[ ] Contribute modal (themed, with live preview)
[ ] Reports - Overview
[ ] Reports - By category
[ ] Reports - Trends
[ ] Reports - Savings
[ ] Notifications center (auto-derived rows + persisted overlay)

Settings & Account:
[ ] Settings page
[ ] Profile/Account
[ ] Privacy settings
[ ] Notification settings

Shared Screens:
[ ] Confirmation dialogs
[ ] Error messages
[ ] Loading states
[ ] Empty states
[ ] Success messages
```

---

# 🎨 DESIGN PRINCIPLES

## **For Both Web & Mobile**

```
1. CLARITY
   ├─ Clear visual hierarchy
   ├─ Easy to understand data
   └─ Simple navigation

2. ACCESSIBILITY
   ├─ Large tap targets (mobile)
   ├─ Color-blind friendly
   ├─ Readable text (18px+ on mobile)
   └─ Keyboard navigation (web)

3. RESPONSIVENESS
   ├─ Works on all screen sizes
   ├─ Touch-friendly mobile
   ├─ Mouse-friendly web
   └─ No horizontal scroll (mobile)

4. CONSISTENCY
   ├─ Same colors across app
   ├─ Same icons for same actions
   ├─ Same spacing/padding
   └─ Unified design language

5. FEEDBACK
   ├─ Visual feedback on interaction
   ├─ Loading indicators
   ├─ Error messages
   ├─ Success confirmations
   └─ Toast notifications

6. PERFORMANCE
   ├─ Fast load times
   ├─ Smooth animations
   ├─ No jank or lag
   └─ Optimized images

7. SECURITY
   ├─ Show security features
   ├─ Reassure user about data
   ├─ Clear permissions
   └─ HTTPS everywhere
```

---

# 🎨 DESIGN TOOLS RECOMMENDATIONS

```
DESIGN:
├─ Figma (collaborative, free tier)
├─ Sketch (Mac only)
├─ Adobe XD
└─ Penpot (open source)

PROTOTYPING:
├─ Figma (interactive)
├─ Framer
├─ Adobe XD
└─ InVision

DESIGN SYSTEMS:
├─ Storybook (component library)
├─ Zeroheight (design docs)
└─ Figma (shared component library)

UI KITS:
├─ Material Design (free)
├─ iOS HIG (free)
├─ Tailwind UI (paid)
└─ Bootstrap (free)

ICON LIBRARIES:
├─ Feather Icons (free)
├─ Material Icons (free)
├─ Font Awesome (free tier)
└─ Heroicons (free)

COLOR PICKER:
├─ Coolors.co
├─ Color Hunt
└─ Adobe Color
```

---

# ✅ FINAL SUMMARY

```
Total Unique Screens to Design:    35+
├─ Mobile exclusive:               18+
├─ Web exclusive:                  14+
└─ Shared/Overlays:               ~10+

Design Time Estimate:              4-6 weeks
├─ Wireframes:                     1 week
├─ High-fidelity mockups:         2 weeks
├─ Prototype & testing:           1-2 weeks
└─ Iterations:                    1-2 weeks

Tools Needed:
├─ Figma (free tier works)
└─ Optional: Prototyping tool

Next Steps:
1. Create wireframes for all screens
2. Build design system & component library
3. Create high-fidelity mockups
4. Build interactive prototype
5. User testing & iterations
6. Hand off to developers (with Figma file)
```

---

**This document is your complete screen design blueprint.**

Use this to:
- Create wireframes in Figma
- Build high-fidelity mockups
- Create interactive prototypes
- Brief the design team
- Guide development
- User testing

**Start with wireframes, move to mockups, then prototype!** 🎨



