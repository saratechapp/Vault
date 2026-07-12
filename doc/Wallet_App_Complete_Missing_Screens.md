# WALLET APP - COMPLETE MISSING SCREENS
## All Authentication, Onboarding, and Additional Screens

**Document Type:** Screen Design Specification (Supplementary)  
**Created:** July 2, 2026  
**Total Additional Screens:** 30+ screens

---

# 🔐 AUTHENTICATION FLOWS (Both Mobile & Web)

## **Screen 1: Splash Screen** (Mobile & Web)
```
Duration: 2-3 seconds (auto-advance)

Content:
├─ App logo (large, centered)
├─ App name: "Wallet"
├─ Loading animation (spinner or progress bar)
└─ Optional: Tagline or motivational message

Design Notes:
- Full screen, primary brand color
- Smooth fade-in animation
- Auto-dismiss to login after 2-3 seconds
- Responsive on all devices

Wireframe:
┌──────────────────────┐
│                      │
│         📱           │ (Logo)
│       WALLET         │ (App name)
│                      │
│        ⌛ ↻ ↙       │ (Loading spinner)
│                      │
│  "Managing Money     │ (Optional tagline)
│   Made Simple"       │
│                      │
└──────────────────────┘

Transitions:
- Auto-navigate to Login OR Home (if user logged in)
- Fade-out transition
```

---

## **Screen 2: Login Screen** (Both Mobile & Web)

### **Mobile Version:**
```
Header:
├─ App logo (smaller than splash)
└─ "Welcome back"

Form Fields:
├─ Email/Phone input
│  ├─ Placeholder: "Email or phone number"
│  ├─ Input type: email
│  └─ Validation: Real-time

├─ Password input
│  ├─ Placeholder: "Password"
│  ├─ Show/hide toggle
│  └─ Validation: Password visible when needed

├─ "Keep me logged in" checkbox
│  └─ Remember for next time

└─ [Login] button (full width, primary color)

Links:
├─ [Forgot password?] (center, gray text)
└─ [Don't have an account? Sign up] (center, blue text)

Social Login (Optional):
├─ [Continue with Google]
├─ [Continue with Apple]
└─ "OR" divider

Design Notes:
- Clean, minimal form
- Large input fields (easy to tap)
- Clear error messages
- Loading state when submitting
- Password field shows/hides on toggle
- Keyboard optimization

Wireframe:
┌──────────────────────┐
│       WALLET         │ (Logo)
│   Welcome Back       │ (Heading)
├──────────────────────┤
│ ┌──────────────────┐ │
│ │ Email or Phone   │ │ (Input field)
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ Password      [👁] │ │ (Input + toggle)
│ └──────────────────┘ │
│                      │
│ ☐ Keep me logged in  │ (Checkbox)
│                      │
│ ┌──────────────────┐ │
│ │     LOGIN        │ │ (Button)
│ └──────────────────┘ │
│                      │
│ Forgot password?     │ (Link)
│ Don't have account?  │ (Link)
│        OR            │ (Divider)
│ [Google] [Apple]     │ (Social buttons)
└──────────────────────┘

Form States:
- Empty: Disabled login button
- Invalid email: Red border + error message
- Valid: Enabled button
- Submitting: Loading spinner in button
- Error: Error message below form
```

### **Web Version (Desktop):**
```
Layout: Centered card on light/dark background

┌─────────────────────────────────┐
│      WALLET Login               │
├─────────────────────────────────┤
│                                 │
│ Welcome back! Please login to    │
│ your account.                   │
│                                 │
│ Email or Phone Number:          │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ Password:                       │
│ ┌─────────────────────────────┐ │
│ │                          [👁]│ │
│ └─────────────────────────────┘ │
│                                 │
│ ☐ Keep me logged in             │
│                                 │
│ ┌─────────────────────────────┐ │
│ │        LOGIN                │ │
│ └─────────────────────────────┘ │
│                                 │
│  Forgot password?               │
│                                 │
│  Don't have an account?         │
│  [Create one]                   │
│                                 │
│  ──── OR ────                   │
│                                 │
│ [Google Login] [Apple Login]    │
│                                 │
└─────────────────────────────────┘

Additional Features (Web):
- Keyboard enter to submit
- Tab navigation
- Hover states on buttons
- Responsive to mobile size
```

---

## **Screen 3: Sign Up Screen** (Both Mobile & Web)

### **Mobile Version:**
```
Header:
├─ Back button (<)
└─ "Create Account"

Form Fields:
├─ Full Name
│  ├─ Placeholder: "Your name"
│  └─ Required

├─ Email Address
│  ├─ Placeholder: "Email address"
│  ├─ Input type: email
│  └─ Real-time validation

├─ Phone Number (optional)
│  ├─ Placeholder: "+91 XXXXXXXXXX"
│  ├─ International format
│  └─ Optional (can skip)

├─ Password
│  ├─ Placeholder: "Create password"
│  ├─ Show/hide toggle
│  ├─ Strength indicator:
│  │  ├─ Weak (red bar)
│  │  ├─ Fair (orange bar)
│  │  ├─ Good (yellow bar)
│  │  └─ Strong (green bar)
│  └─ Requirements:
│     ├─ At least 8 characters
│     ├─ Mix of uppercase & lowercase
│     ├─ At least one number
│     └─ At least one special character

├─ Confirm Password
│  ├─ Must match password field
│  └─ Real-time validation

├─ Terms Acceptance
│  ├─ "I agree to Terms of Service"
│  ├─ "I agree to Privacy Policy"
│  └─ Required checkboxes

└─ [Create Account] button (full width)

Links:
├─ [Already have an account? Login] (center, blue)

Social Sign Up:
├─ [Sign up with Google]
├─ [Sign up with Apple]
└─ "OR" divider

Design Notes:
- Password strength indicator visual
- Clear requirements for password
- Can skip phone if not needed
- Terms links should open in new tab/modal
- Validation as user types

Wireframe:
┌──────────────────────┐
│ < Create Account     │ (Header)
├──────────────────────┤
│ ┌──────────────────┐ │
│ │ Your Name        │ │ (Name input)
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ Email Address    │ │ (Email input)
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ Phone (optional) │ │ (Phone input)
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ Password      [👁] │ │ (Password input)
│ └──────────────────┘ │
│ Password strength:   │
│ ████░░░░░░░░░░░░░░ │ (Strength bar)
│ Requirements:        │
│ ☑ 8+ characters      │
│ ☑ Uppercase letter   │
│ ☑ Number            │
│ ☑ Special char      │
│                      │
│ ┌──────────────────┐ │
│ │ Confirm Password │ │ (Confirm input)
│ └──────────────────┘ │
│                      │
│ ☐ I agree to Terms   │ (Checkbox 1)
│ ☐ I agree to Privacy │ (Checkbox 2)
│                      │
│ ┌──────────────────┐ │
│ │  CREATE ACCOUNT  │ │ (Button)
│ └──────────────────┘ │
│                      │
│ Already have account?│ (Link)
│        OR            │ (Divider)
│ [Google] [Apple]     │ (Social buttons)
└──────────────────────┘
```

### **Web Version:**
```
Similar layout but in a centered card
- Wider form fields
- Better password strength indicator
- All fields visible at once (no scrolling)
- Tab between fields
```

---

## **Screen 4: Email Verification Screen** (Both Mobile & Web)

```
Appears after sign up (if email verification is required)

Header:
├─ Email icon (large)
└─ "Verify your email"

Content:
├─ Heading: "Verify your email address"
├─ Subheading: "We sent a verification code to:"
├─ Email display: "user@example.com" (with edit option)
│
├─ Verification code input
│  ├─ 6 digit code field (or 4 digit depending on design)
│  ├─ Auto-focus on first digit
│  ├─ Auto-advance to next field when digit entered
│  └─ Paste support (detect code in clipboard)
│
├─ Timer: "Resend in 60 seconds" (countdown)
│  └─ After 60s: [Resend Code] becomes active
│
├─ [Verify] button
│  └─ Disabled until all 6 digits entered

Actions:
├─ [Resend Code] (after timer)
├─ [Change Email] (optional)
└─ [Back to Login] (optional)

Error Handling:
├─ Invalid code: "Incorrect code. Try again."
├─ Expired code: "Code expired. Request a new one."
└─ Too many attempts: "Too many attempts. Please try again later."

Wireframe:
┌──────────────────────┐
│       📧             │ (Icon)
│ Verify Your Email    │ (Heading)
├──────────────────────┤
│ We sent a code to:   │
│ user@example.com     │
│ [Change]             │
│                      │
│ Enter verification   │
│ code:                │
│ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ │
│ │ │ │ │ │ │ │ │ │ │ │ │ │
│ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ │
│                      │
│ Resend in 45 seconds │ (Timer)
│                      │
│ ┌──────────────────┐ │
│ │     VERIFY       │ │ (Button)
│ └──────────────────┘ │
│                      │
│ [Change Email]       │ (Link)
└──────────────────────┘

Mobile-Specific:
- Large digit input fields (easy to tap)
- Auto-fill from SMS (if available)
- Keyboard only shows numbers

Web-Specific:
- Can paste entire code
- Auto-focus first field
```

---

## **Screen 5: Forgot Password - Step 1 (Email Entry)**

```
Header:
├─ Back button
└─ "Reset Password"

Content:
├─ Icon: 🔐 (lock or key)
├─ Heading: "Forgot your password?"
├─ Subheading: "Enter your email address and we'll send you a password reset link"
│
├─ Email input field
│  ├─ Placeholder: "Enter your email address"
│  ├─ Validation: Real-time email check
│  └─ Error: "Email not found" (if doesn't exist)
│
└─ [Send Reset Link] button
   └─ Disabled until valid email entered

Links:
├─ [Back to Login]
└─ [Don't have account? Sign up]

Wireframe:
┌──────────────────────┐
│ < Reset Password     │
├──────────────────────┤
│         🔐           │ (Icon)
│ Forgot Password?     │ (Heading)
│                      │
│ Enter your email and │
│ we'll send a reset   │
│ link.                │
│                      │
│ ┌──────────────────┐ │
│ │ Email Address    │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ SEND RESET LINK  │ │
│ └──────────────────┘ │
│                      │
│ [Back to Login]      │ (Link)
└──────────────────────┘
```

---

## **Screen 6: Forgot Password - Step 2 (Link Sent)**

```
Header:
└─ "Check your email"

Content:
├─ Icon: ✅ (checkmark or envelope)
├─ Heading: "Check your email"
├─ Subheading: "We sent a password reset link to:"
├─ Email display: "user@example.com"
│
├─ Instructions:
│  └─ "Click the link in the email to reset your password."
│     "Link expires in 24 hours."
│
├─ Timer: "Didn't receive email?" (can click after 30 seconds)
│  └─ [Resend Email] button (becomes active after 30s)
│
├─ Alternative: "Check spam/promotions folder"
│
└─ Actions:
   ├─ [Resend Email] (after timer)
   ├─ [Change Email] (go back to step 1)
   └─ [Back to Login]

Wireframe:
┌──────────────────────┐
│  Check Your Email    │
├──────────────────────┤
│          ✅          │ (Icon)
│ Check Your Email     │ (Heading)
│                      │
│ We sent a reset link │
│ to:                  │
│ user@example.com     │
│                      │
│ Click the link in    │
│ the email to reset   │
│ your password.       │
│ Link expires in 24h. │
│                      │
│ Didn't get email?    │
│ Check spam folder    │
│                      │
│ Resend in 25 sec     │ (Timer)
│                      │
│ [Change Email]       │ (Link)
│ [Back to Login]      │ (Link)
└──────────────────────┘
```

---

## **Screen 7: Forgot Password - Step 3 (Password Reset)**

```
Accessed via email link (web and mobile)

Header:
└─ "Create new password"

Form Fields:
├─ New Password
│  ├─ Placeholder: "New password"
│  ├─ Show/hide toggle
│  ├─ Strength indicator
│  └─ Requirements shown

├─ Confirm Password
│  ├─ Must match new password
│  └─ Real-time validation

└─ [Reset Password] button

Error Handling:
├─ Link expired: "Your reset link has expired. Request a new one."
├─ Token invalid: "Invalid reset link. Request a new one."
└─ Password mismatch: "Passwords don't match."

Success:
├─ "Password reset successfully!"
├─ Auto-redirect to login after 2 seconds
└─ Can click [Back to Login] immediately

Wireframe:
┌──────────────────────┐
│ Create New Password  │
├──────────────────────┤
│ ┌──────────────────┐ │
│ │ New Password  [👁] │
│ └──────────────────┘ │
│ ████████░░░░░░░░░░ │ (Strength)
│                      │
│ ┌──────────────────┐ │
│ │ Confirm Pass   [👁] │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ RESET PASSWORD   │ │
│ └──────────────────┘ │
│                      │
│ [Back to Login]      │ (Link)
└──────────────────────┘
```

---

# 🎯 ONBOARDING FLOW (Mobile & Web)

## **Screen 8: Onboarding - Screen 1 (Welcome)**

```
Full screen, can swipe/tap to next

Content:
├─ Large illustration/icon
│  └─ Theme: Money management, control, growth
│
├─ Heading: "Take Control of Your Money"
├─ Subheading: "Manage your budget, track spending, and reach your financial goals"
│
├─ Dots indicator: • ◯ ◯ (showing page 1 of 3)
│
└─ Navigation:
   ├─ [Next] / [→] button (or swipe)
   └─ [Skip] / [Later] (optional)

Design Notes:
- Eye-catching illustration
- Clear benefit statement
- Smooth swipe animation
- Can skip onboarding if desired

Wireframe:
┌──────────────────────┐
│     WALLET           │ (App name/logo)
│                      │
│        💰 💸 📈     │ (Illustration)
│                      │
│ Take Control of      │ (Heading)
│ Your Money           │
│                      │
│ Manage your budget,  │ (Subheading)
│ track spending, and  │
│ reach your goals     │
│                      │
│ • ◯ ◯               │ (Page indicator)
│                      │
│ [Next] [Skip]        │ (Buttons)
└──────────────────────┘
```

---

## **Screen 9: Onboarding - Screen 2 (Track Spending)**

```
Content:
├─ Large illustration
│  └─ Theme: Transaction tracking, receipts, history
│
├─ Heading: "Track Every Expense"
├─ Subheading: "Add transactions manually, import from bank, or scan receipts with your camera"
│
├─ Features shown:
│  ├─ ✓ Manual entry
│  ├─ ✓ CSV import
│  └─ ✓ Receipt OCR
│
├─ Dots indicator: ◯ • ◯
│
└─ Navigation:
   ├─ [Next]
   ├─ [Back]
   └─ [Skip]

Wireframe:
┌──────────────────────┐
│        📸 📋 ✍️     │ (Illustration)
│                      │
│ Track Every Expense  │ (Heading)
│                      │
│ Add transactions:    │ (Subheading)
│ • Manually enter     │
│ • Import from bank   │
│ • Scan receipts      │
│                      │
│ ◯ • ◯               │ (Page indicator)
│                      │
│ [Back] [Next] [Skip] │ (Buttons)
└──────────────────────┘
```

---

## **Screen 10: Onboarding - Screen 3 (Budget & Goals)**

```
Content:
├─ Large illustration
│  └─ Theme: Budget progress, goals, savings
│
├─ Heading: "Budget Smart & Save Big"
├─ Subheading: "Set budgets, create savings goals, and get alerts when spending too much"
│
├─ Features shown:
│  ├─ ✓ Budget tracking
│  ├─ ✓ Savings goals
│  └─ ✓ Smart alerts
│
├─ Dots indicator: ◯ ◯ •
│
└─ Navigation:
   ├─ [Back]
   └─ [Get Started] (final button, leads to next step)

Wireframe:
┌──────────────────────┐
│      🎯 💰 📈      │ (Illustration)
│                      │
│ Budget Smart &       │ (Heading)
│ Save Big             │
│                      │
│ Track spending:      │ (Subheading)
│ • Set budgets        │
│ • Create goals       │
│ • Get alerts         │
│                      │
│ ◯ ◯ •               │ (Page indicator)
│                      │
│ [Back]  [GET STARTED] │ (Buttons)
└──────────────────────┘
```

---

## **Screen 11: Onboarding - Currency Setup**

```
Header:
└─ "Choose your currency"

Content:
├─ Explanation: "This can be changed later in settings"
│
├─ Currency list (searchable):
│  ├─ Popular currencies at top:
│  │  ├─ [ ] Indian Rupee (₹) - INR
│  │  ├─ [ ] US Dollar ($) - USD
│  │  ├─ [ ] Euro (€) - EUR
│  │  ├─ [ ] British Pound (£) - GBP
│  │  └─ [ ] Australian Dollar (A$) - AUD
│  │
│  ├─ Search box: "Search currency..."
│  │
│  └─ All currencies (alphabetical)
│     ├─ [ ] Argentine Peso...
│     ├─ [ ] Brazilian Real...
│     └─ ... (long list)
│
└─ [Continue] button (active when currency selected)

Design Notes:
- Radio buttons (single select)
- Pre-select based on device locale
- Search for quick access
- Code visible (INR, USD, etc.)
- Can change later

Wireframe:
┌──────────────────────┐
│ Choose your currency │
├──────────────────────┤
│                      │
│ ┌──────────────────┐ │
│ │ Search...        │ │ (Search box)
│ └──────────────────┘ │
│                      │
│ Popular:             │
│ ⊙ Indian Rupee (₹)   │ (Selected)
│ ◯ US Dollar ($)      │
│ ◯ Euro (€)           │
│ ◯ British Pound (£)  │
│ ◯ Aus Dollar (A$)    │
│                      │
│ All currencies:      │
│ ◯ Argentine Peso...  │
│ ◯ Brazilian Real...  │
│ ...                  │
│                      │
│ ┌──────────────────┐ │
│ │    CONTINUE      │ │
│ └──────────────────┘ │
└──────────────────────┘
```

---

## **Screen 12: Onboarding - Bank Connection (Optional)**

```
Header:
├─ "Connect your bank (Optional)"
└─ "You can add it later"

Content:
├─ Icon: 🏦 (bank building)
├─ Heading: "Sync with your bank"
├─ Subheading: "Automatically sync transactions from your bank account"
│
├─ Benefits:
│  ├─ ✓ Auto-sync transactions
│  ├─ ✓ Auto-categorization
│  ├─ ✓ Save time
│  └─ ✓ Never miss a transaction
│
├─ Security note:
│  └─ "🔒 Your data is encrypted and secure"
│
└─ Actions:
   ├─ [Connect Bank] (primary button)
   ├─ [Skip for Now] (secondary button)
   └─ [Import CSV Instead] (tertiary link)

Alternative (If user skips bank):
├─ Explanation: "You can add your bank later"
├─ Options shown:
│  ├─ Import from CSV
│  ├─ Add manually
│  └─ Or connect bank anytime
│
└─ [Continue]

Wireframe:
┌──────────────────────┐
│  Connect Your Bank   │
│    (Optional)        │
├──────────────────────┤
│          🏦          │ (Icon)
│                      │
│ Sync with your bank  │ (Heading)
│                      │
│ Auto-sync txns from  │ (Benefits)
│ your bank account    │
│                      │
│ ✓ Auto-sync          │
│ ✓ Auto-categorize    │
│ ✓ Save time          │
│ ✓ No missed txns     │
│                      │
│ 🔒 Encrypted & Secure │ (Security)
│                      │
│ ┌──────────────────┐ │
│ │ CONNECT BANK     │ │ (Primary button)
│ └──────────────────┘ │
│                      │
│ [Skip for Now]       │ (Link)
│ [Import CSV]         │ (Link)
└──────────────────────┘
```

---

## **Screen 13: Onboarding - Profile Setup**

```
Header:
└─ "Set up your profile"

Form Fields:
├─ Profile picture (optional)
│  ├─ [Take Photo] or [Choose from Gallery]
│  ├─ Upload button
│  └─ Can skip

├─ Full name
│  ├─ Placeholder: "Your name"
│  └─ Required

├─ Username (optional)
│  ├─ Placeholder: "Choose a username"
│  └─ For future social features

├─ Date of birth (optional)
│  ├─ Date picker
│  └─ "Helps us personalize your experience"

└─ [Complete Setup] button

Wireframe:
┌──────────────────────┐
│ Set up your profile  │
├──────────────────────┤
│                      │
│    ┌──────────┐     │
│    │    📷    │     │ (Profile pic)
│    └──────────┘     │
│ [Upload Photo]      │
│                      │
│ ┌──────────────────┐ │
│ │ Your Name        │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ Username         │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ Date of Birth    │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ COMPLETE SETUP   │ │
│ └──────────────────┘ │
└──────────────────────┘
```

---

## **Screen 14: Onboarding - Initial Budget Setup**

```
Header:
└─ "Create your first budget"

Content:
├─ Explanation: "Set budgets to stay on track"
├─ "You can change these later"
│
├─ Quick preset options:
│  ├─ [Minimal Setup] (3 categories)
│  ├─ [Standard Setup] (8 categories) ← Recommended
│  └─ [Complete Setup] (14 categories)
│
├─ OR manual setup:
│  ├─ Category selector
│  ├─ Budget amount input
│  ├─ [+ Add Another]
│  └─ [+ Add Category]

└─ [Continue to Dashboard] button

Wireframe:
┌──────────────────────┐
│ Create Your First    │
│ Budget               │
├──────────────────────┤
│ Set budgets to stay  │
│ on track             │
│                      │
│ Quick Setup:         │
│ [Minimal] [Standard] │
│ [Complete]           │
│           ↓          │
│ Recommended (8 cats) │
│                      │
│ Manual Setup:        │
│ Groceries: ₹5,000    │
│ Transport: ₹3,000    │
│ [+ Add More]         │
│                      │
│ ┌──────────────────┐ │
│ │ GO TO DASHBOARD  │ │
│ └──────────────────┘ │
└──────────────────────┘
```

---

## **Screen 15: Onboarding - Completion**

```
Header & Content:
├─ Icon: 🎉
├─ Heading: "All set!"
├─ Subheading: "You're ready to start managing your finances"
│
├─ Summary of what's been set up:
│  ├─ ✅ Profile created
│  ├─ ✅ Currency set (INR)
│  ├─ ✅ Budgets created
│  ├─ Optional: ✅ Bank connected
│  └─ Optional: ✅ Goals created
│
├─ Next steps:
│  ├─ "Add your first transaction"
│  ├─ "Track your spending"
│  └─ "Watch your progress"
│
└─ [Go to Dashboard] button (primary)

Celebration:
- Confetti animation (optional)
- Motivational message
- Clear next action

Wireframe:
┌──────────────────────┐
│        🎉 🎉        │
│      All Set!        │
├──────────────────────┤
│                      │
│ You're ready to      │
│ manage your money!   │
│                      │
│ ✅ Profile created   │
│ ✅ Currency set      │
│ ✅ Budgets created   │
│ ✅ Bank connected    │
│                      │
│ Next: Add your first │
│ transaction and      │
│ start tracking!      │
│                      │
│ ┌──────────────────┐ │
│ │ GO TO DASHBOARD  │ │
│ └──────────────────┘ │
│                      │
│ [Help] [Settings]    │
└──────────────────────┘
```

---

# 📲 PERMISSION SCREENS (Mobile Only)

## **Screen 16: Camera Permission Request**

```
Appears when user tries to use camera for OCR

┌──────────────────────┐
│  WALLET needs your   │
│  camera permission   │
├──────────────────────┤
│          📷          │ (Icon)
│                      │
│ Allow Camera Access  │ (Title)
│                      │
│ Wallet needs access  │
│ to your camera to    │
│ scan receipts.       │
│                      │
│ Your photos are      │ (Privacy assurance)
│ never stored or      │
│ shared.              │
│                      │
│ ┌──────────────────┐ │
│ │  ALLOW           │ │
│ └──────────────────┘ │
│                      │
│ [Not Now] [Never]    │
└──────────────────────┘
```

---

## **Screen 17: Notification Permission Request**

```
┌──────────────────────┐
│  WALLET wants to     │
│  send notifications  │
├──────────────────────┤
│          🔔          │ (Icon)
│                      │
│ Allow Notifications  │ (Title)
│                      │
│ Get alerts for:      │
│ • Budget overspending│
│ • Bill due dates     │
│ • Goal milestones    │
│ • Weekly summaries   │
│                      │
│ ┌──────────────────┐ │
│ │  ALLOW           │ │
│ └──────────────────┘ │
│                      │
│ [Not Now] [Never]    │
└──────────────────────┘
```

---

## **Screen 18: Biometric Permission Request**

```
┌──────────────────────┐
│  WALLET wants to     │
│  use Face ID/Biometric
├──────────────────────┤
│          👆          │ (Icon)
│                      │
│ Enable Biometric     │ (Title)
│                      │
│ Quickly unlock your  │
│ Wallet account with  │
│ Face ID or           │
│ Fingerprint          │
│                      │
│ It's secure and fast │
│                      │
│ ┌──────────────────┐ │
│ │  ENABLE          │ │
│ └──────────────────┘ │
│                      │
│ [Skip] [Ask Later]   │
└──────────────────────┘
```

---

# 🔔 NOTIFICATIONS & ALERTS (Mobile & Web)

## **Screen 19: Push Notification - Budget Alert**

```
Appears as system notification (mobile) or in-app (web)

Mobile:
┌──────────────────────┐
│ ⚠️ Budget Alert      │ (Notification title)
├──────────────────────┤
│ Groceries: 85%       │ (Notification body)
│ You've spent ₹1,700  │
│ of ₹2,000            │
│                      │
│ [View] [Dismiss]     │ (Actions)
└──────────────────────┘

Web (Toast):
┌──────────────────────┐
│ ⚠️  Groceries Budget │
│ at 85% of limit      │
│ [View]      [✕]     │
└──────────────────────┘
```

---

## **Screen 20: Push Notification - Bill Due**

```
Mobile:
┌──────────────────────┐
│ 📋 Bill Due Today    │ (Title)
├──────────────────────┤
│ Rent payment due     │ (Body)
│ ₹20,000 due today    │
│                      │
│ [Pay] [Remind]       │ (Actions)
└──────────────────────┘

Web (Toast):
┌──────────────────────┐
│ 📋 Rent due today    │
│ ₹20,000              │
│ [Mark Paid]  [✕]    │
└──────────────────────┘
```

---

## **Screen 21: In-App Notifications Center** (Mobile & Web)

```
Mobile Screen:

Header:
├─ Title: "Notifications"
└─ [Clear All] button

Notification List (sorted danger → warning → success → info):
├─ For each notification:
│  ├─ Icon (budget/bill/goal/insight)
│  ├─ Title
│  ├─ Body text
│  ├─ Colored tone chip (red/amber/emerald/cyan)
│  ├─ Time (e.g., "2 hours ago")
│  └─ Mark as read (swipe/tap)
│
├─ Sections:
│  ├─ Today
│  ├─ This Week
│  ├─ Older
│  └─ [Load More]

Data source (backend):
├─ Auto-derived from real user state via generateNotificationsFor(userData).
│  Triggers: bill overdue, bill due soon, over budget, budget alert,
│  goal reached, inactivity insight.
├─ Deterministic id per row (gen_<kind>_<sourceId>) so re-runs don't duplicate.
└─ userData.notifications persists an overlay { id, read?, dismissed? }
   keyed on those ids so state survives backend restarts. Legacy hand-seeded
   rows (id not starting with gen_) still render — backward compatible.

Design Notes:
- Swipe to dismiss
- Tap to see details
- Mark as read
- Delete individual notifications
- Frontend respects a server-provided `tone` so two rows sharing a type
  can render different colors (e.g., overdue red vs. due-soon amber).

Wireframe:
┌──────────────────────┐
│ Notifications [×All] │
├──────────────────────┤
│ Today                │
│ ⚠️ Budget Alert      │ (Notification 1)
│ Groceries at 85%     │ 2 hours ago
│                      │
│ 🎉 Goal Milestone    │ (Notification 2)
│ You've saved 50%!    │ 5 hours ago
│                      │
│ 📋 Bill Reminder     │ (Notification 3)
│ Rent due tomorrow    │ Yesterday
│                      │
│ This Week            │
│ 📊 Weekly Summary    │ (Notification 4)
│ You spent ₹15,000    │ 3 days ago
│                      │
│ [Load More...]       │
└──────────────────────┘

Web Version:
- Similar layout
- Right sidebar or dropdown menu
- Bell icon in top nav shows count
```

---

# 🚨 ERROR & VALIDATION SCREENS

## **Screen 22: Network Error**

```
┌──────────────────────┐
│         ⚠️           │
│   No Connection      │
├──────────────────────┤
│ Check your internet  │
│ connection and try   │
│ again.               │
│                      │
│ ┌──────────────────┐ │
│ │      RETRY       │ │
│ └──────────────────┘ │
│                      │
│ [Work Offline] (if applicable)
│ [Help]               │
└──────────────────────┘

Design Notes:
- Clear error icon
- Helpful message
- Clear action buttons
- Retry easily accessible
```

---

## **Screen 23: Server Error (500)**

```
┌──────────────────────┐
│         ⚠️           │
│  Something Went      │
│  Wrong               │
├──────────────────────┤
│ Our servers are      │
│ having trouble.      │
│ Please try again     │
│ later.               │
│                      │
│ Error code: 500      │
│                      │
│ ┌──────────────────┐ │
│ │  BACK TO HOME    │ │
│ └──────────────────┘ │
│                      │
│ [Contact Support]    │
│ [Status Page]        │
└──────────────────────┘
```

---

## **Screen 24: 404 Not Found**

```
┌──────────────────────┐
│         404          │
│   Page Not Found     │
├──────────────────────┤
│                      │
│ The page you're      │
│ looking for doesn't  │
│ exist.               │
│                      │
│ ┌──────────────────┐ │
│ │    GO HOME       │ │
│ └──────────────────┘ │
│                      │
│ [Back]               │
│ [Contact Support]    │
└──────────────────────┘
```

---

# 📊 ADDITIONAL FEATURE SCREENS

## **Screen 25: Search/Filter Modal** (Mobile & Web)

```
Mobile Version:

Header:
├─ Title: "Search"
├─ Search input (auto-focused)
└─ [X] Close button

Content:
├─ Search box
│  ├─ Placeholder: "Search transactions..."
│  ├─ Real-time results
│  └─ Clear button (X)
│
├─ Recent searches
│  ├─ "Groceries"
│  ├─ "Starbucks"
│  └─ [Clear all]
│
├─ Search results
│  ├─ Matching transactions
│  ├─ Match highlighting
│  └─ Grouped by date

Web Version:
- Sidebar filters
- Advanced search options
- Date range picker
- Category multi-select
- Amount range slider
- Payment method filter
- Apply/Reset buttons
```

---

## **Screen 26: Import Bank Statement** (Both)

```
Header:
└─ "Import Bank Statement"

Content:
├─ File upload area
│  ├─ Drag & drop zone
│  ├─ "Drag CSV file here"
│  ├─ "or [Click to browse]"
│  └─ Shows supported formats

├─ CSV Format Help
│  └─ "Need help? [Download template]"

├─ Mapping (after file selected)
│  ├─ Date column selector
│  ├─ Amount column selector
│  ├─ Description column selector
│  ├─ Category auto-detect
│  └─ Preview of data

├─ Review imported data
│  ├─ Show 5-10 sample rows
│  ├─ Adjustable settings
│  └─ [Preview all]

└─ Actions:
   ├─ [Import] (when ready)
   ├─ [Cancel]
   └─ [Edit mapping]

Wireframe:
┌──────────────────────┐
│ Import Bank Stmt     │
├──────────────────────┤
│                      │
│ ┌──────────────────┐ │
│ │ 📎              │ │
│ │ Drag CSV here   │ │ (Drop zone)
│ │ or [Browse]     │ │
│ └──────────────────┘ │
│                      │
│ Supported: CSV, XLS  │
│                      │
│ [Download template]  │
│                      │
│ Column Mapping:      │
│ Date: [Column A] ▼   │
│ Amount: [Column B] ▼ │
│ Desc: [Column C] ▼   │
│                      │
│ Preview:             │
│ ┌──────────────────┐ │
│ │ 01/15  Grocery -500│ │
│ │ 01/16  Salary +50k │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │     IMPORT       │ │
│ └──────────────────┘ │
└──────────────────────┘
```

---

## **Screen 27: Category Suggestion/Auto-Categorize**

```
When user adds transaction without category:

┌──────────────────────┐
│ Select Category      │
├──────────────────────┤
│                      │
│ "Starbucks" found:   │
│ Suggested category:  │
│ ⭐ Food & Dining     │
│    (High confidence) │
│                      │
│ Other options:       │
│ ◯ Entertainment      │
│ ◯ Coffee/Tea         │
│ ◯ Subscription       │
│ ◯ Shopping           │
│ ◯ [Create new]       │
│                      │
│ ┌──────────────────┐ │
│ │ CONFIRM          │ │
│ └──────────────────┘ │
│                      │
│ [Edit manually]      │
└──────────────────────┘
```

---

## **Screen 28: Budget Overspend Confirmation**

```
When user tries to add transaction that exceeds budget:

┌──────────────────────┐
│ ⚠️ Budget Alert      │
├──────────────────────┤
│                      │
│ Adding this will     │
│ exceed your Groceries│
│ budget.              │
│                      │
│ Current: ₹1,900      │
│ Limit: ₹2,000        │
│ New total: ₹2,100    │
│ Overspend: ₹100      │
│                      │
│ Add anyway?          │
│                      │
│ ┌──────────────────┐ │
│ │ ADD ANYWAY       │ │
│ └──────────────────┘ │
│                      │
│ [Cancel] [Edit amt]  │
└──────────────────────┘
```

---

## **Screen 29: Financial Health Score Detail**

```
Mobile/Web Screen:

Header:
├─ Title: "Financial Health"
├─ Score: 78/100 (large, colored)
└─ Grade: B+ (if applicable)

Breakdown:
├─ Category 1: Budget Adherence
│  ├─ Score: 85/100
│  └─ "You're staying within budget"
│
├─ Category 2: Savings Rate
│  ├─ Score: 70/100
│  └─ "Try to save more"
│
├─ Category 3: Expense Diversity
│  ├─ Score: 75/100
│  └─ "Good variety in spending"
│
├─ Category 4: Income/Expense Balance
│  ├─ Score: 80/100
│  └─ "Positive income flow"
│
└─ Category 5: Goal Progress
   ├─ Score: 75/100
   └─ "On track with goals"

Recommendations:
├─ 💡 "Reduce dining expenses by 10%"
├─ 💡 "Increase emergency fund"
└─ 💡 "Create more savings goals"

Wireframe:
┌──────────────────────┐
│ Financial Health     │
├──────────────────────┤
│         78           │ (Score)
│      /100 • B+       │
│                      │
│ Budget Adherence: 85 │ (Category 1)
│ ████████░░░░░░░░░░ │
│ ✓ Staying within budget
│                      │
│ Savings Rate: 70     │ (Category 2)
│ ███████░░░░░░░░░░░░ │
│ ⚠️ Try to save more
│                      │
│ (more categories...)  │
│                      │
│ Recommendations:     │
│ 💡 Reduce dining 10% │
│ 💡 Increase e-fund   │
│ 💡 More goals        │
└──────────────────────┘
```

---

## **Screen 30: Transaction Receipt/Details**

```
Full screen (modal on mobile, page on web)

Header:
├─ Back button
├─ Edit button
└─ More options menu (...)

Content:
├─ Receipt image (if available)
│  ├─ Full size display
│  ├─ Pinch to zoom (mobile)
│  ├─ [Download] button
│  └─ [Share] button
│
├─ Transaction details
│  ├─ Amount: ₹1,200 (large)
│  ├─ Vendor: Starbucks
│  ├─ Category: Food & Dining
│  ├─ Date: Jan 15, 2024
│  ├─ Time: 10:30 AM
│  ├─ Payment: Credit Card
│  ├─ Tags: #coffee #daily
│  └─ Notes: "Regular morning coffee"
│
├─ Edit history
│  └─ "Last edited: 2 days ago"
│
└─ Actions
   ├─ [Edit] button
   ├─ [Duplicate] button
   ├─ [Delete] button
   └─ [Add to Goal]

Wireframe:
┌──────────────────────┐
│ < [Edit] [...] 📎   │ (Header)
├──────────────────────┤
│                      │
│  ┌────────────────┐  │
│  │   Receipt img  │  │ (Receipt)
│  │   (if avail)   │  │
│  │                │  │
│  │  [Tap to zoom] │  │
│  └────────────────┘  │
│                      │
│ Amount: ₹1,200       │ (Details)
│ Vendor: Starbucks    │
│ Category: Food       │
│ Date: Jan 15, 2024   │
│ Payment: Card        │
│ Tags: #coffee        │
│ Notes: Morning coffee│
│                      │
│ Edited 2 days ago    │
│                      │
│ ┌──────────────────┐ │
│ │      EDIT        │ │ (Actions)
│ └──────────────────┘ │
│ [Duplicate] [Delete] │
└──────────────────────┘
```

---

# 📋 COMPLETE SUPPLEMENTARY SCREENS CHECKLIST

```
AUTHENTICATION (7 screens):
[ ] Splash screen
[ ] Login screen (mobile & web)
[ ] Sign up screen (mobile & web)
[ ] Email verification
[ ] Forgot password - step 1 (email)
[ ] Forgot password - step 2 (link sent)
[ ] Forgot password - step 3 (reset)

ONBOARDING (8 screens):
[ ] Onboarding - Welcome (slide 1)
[ ] Onboarding - Track spending (slide 2)
[ ] Onboarding - Budget & Goals (slide 3)
[ ] Onboarding - Currency setup
[ ] Onboarding - Bank connection
[ ] Onboarding - Profile setup
[ ] Onboarding - Budget setup
[ ] Onboarding - Completion

PERMISSIONS (3 screens - Mobile):
[ ] Camera permission request
[ ] Notification permission request
[ ] Biometric permission request

NOTIFICATIONS (3 screens):
[ ] Push notification - Budget alert
[ ] Push notification - Bill due
[ ] Notifications center (Mobile & Web)

ERROR STATES (3 screens):
[ ] Network error
[ ] Server error (500)
[ ] 404 not found

ADDITIONAL FEATURES (6 screens):
[ ] Search/Filter modal
[ ] Import bank statement
[ ] Category suggestion
[ ] Budget overspend confirmation
[ ] Financial health score detail
[ ] Transaction receipt/details

TOTAL: 30+ supplementary screens
```

---

# 🎨 DESIGN SPECIFICATIONS FOR SUPPLEMENTARY SCREENS

## **Splash Screen**
- Duration: 2-3 seconds
- Animation: Fade in (0.5s), show (1.5s), fade out (0.5s)
- Logo size: 120px diameter
- Font: App name in bold 28px
- Colors: Primary brand color background
- Status bar: Light/Dark depending on theme

## **Login/Signup Forms**
- Input field height: 50px (mobile), 44px (web)
- Button height: 50px (mobile), 44px (web)
- Font size: 16px (inputs), 18px (buttons)
- Border radius: 8px
- Input padding: 12px (horizontal), 12px (vertical)
- Error text: 12px, red color
- Success states: Green checkmark

## **Onboarding Slides**
- Slide height: Full screen minus navigation (mobile)
- Illustration size: 200x200px (mobile), 300x300px (web)
- Font size: 24px (heading), 16px (subheading)
- Page indicator: 8px dots, 4px spacing
- Swipe gesture: 80px minimum
- Animation: Fade/slide transition (0.4s)

## **Permission Screens**
- Icon size: 80px
- Button height: 50px
- Icon color: Primary brand color
- Warning text: Orange/yellow
- System styling (follow iOS/Android guidelines)

## **Notifications**
- Toast height: 60px (web)
- Toast width: 300px (web), full minus padding (mobile)
- Toast position: Top center (web), top of screen (mobile)
- Auto-dismiss: 4-5 seconds
- Notification list item height: 70-80px
- Icon size: 40x40px

## **Error Screens**
- Icon size: 100px
- Error code font: 14px, gray
- Button height: 50px
- Message font: 16px body text
- Colors: Error red or warning yellow

---

# 🎬 SCREEN FLOW DIAGRAM

```
AUTHENTICATION FLOW:
Start
  ↓
Splash Screen
  ↓
Login/Signup?
  ├─ Login → Login screen → (if forgot pwd) → Forgot password flow
  └─ Sign up → Sign up screen → Email verification → Welcome!

ONBOARDING FLOW:
(After first login/signup)
Welcome slide 1
  ↓
Track spending slide 2
  ↓
Budget & Goals slide 3
  ↓
Currency setup
  ↓
Bank connection (optional)
  ↓
Profile setup
  ↓
Budget setup (quick or manual)
  ↓
Completion screen
  ↓
→ Dashboard

MAIN APP FLOW:
Dashboard (home)
  ├─ Add transaction (manual or OCR)
  ├─ View transactions list
  ├─ Manage budgets
  ├─ Manage Recurring & Bills (bills, auto-post rules)
  ├─ Manage goals (create/edit/delete + Contribute)
  ├─ View reports
  └─ Settings

ERROR FLOW:
Action initiated
  ↓
Check network
  ├─ Network error? → Error screen → Retry
  └─ No network → Offline mode
 
Request to server
  ├─ 4xx error (404, 401, etc.) → Specific error screen
  ├─ 5xx error (500, 502, etc.) → Server error screen → Retry
  └─ Success → Show result
```

---

# ✅ TOTAL SCREEN COUNT SUMMARY

```
ORIGINAL SCREENS (from previous doc):   35+
├─ Mobile screens: 18+
├─ Web screens: 20+
└─ Shared/Overlays: 10+

SUPPLEMENTARY SCREENS (this doc):       30+
├─ Authentication: 7
├─ Onboarding: 8
├─ Permissions: 3
├─ Notifications: 3
├─ Error states: 3
└─ Additional features: 6

TOTAL UNIQUE SCREENS:                   65+

COMBINED DESIGN EFFORT:                 8-10 weeks
├─ Wireframes: 2 weeks
├─ High-fidelity mockups: 3 weeks
├─ Component library: 2 weeks
├─ Prototype & testing: 2 weeks
└─ Iterations: 1 week
```

---

# 🎯 DESIGN PRIORITY

## **Design These FIRST (MVP - 25 screens)**

```
Must-Have for Launch:
1. Splash screen
2. Login screen
3. Sign up screen
4. Email verification
5. Onboarding slides (3)
6. Onboarding - Currency setup
7. Onboarding - Completion
8. Dashboard
9. Add transaction (manual & OCR)
10. Transactions list
11. Budgets overview
12. Budget details
13. Recurring & Bills overview (single unified page)
14. Settings
15. Profile
16. Error screens (3)
17. Empty states (3)
18. Loading states (3)
19. Success messages (2)
20. Confirmation dialogs (2)
21. Permission screens (3)
22. Search/Filter
23. Transaction details
24. Notifications center

Total: 25 core screens for MVP
```

## **Design These NEXT (Nice-to-Have)**

```
For v1.1+:
- Import bank statements
- Category suggestion
- Budget overspend warning
- Financial health score
- Onboarding variants
- Additional error states
- More notification types
```

---

**You now have a COMPLETE screen design specification with 65+ screens!**

Use this comprehensive list to:
1. Create wireframes in Figma
2. Build your design system
3. Design high-fidelity mockups
4. Build interactive prototypes
5. Guide development

**Next: Start designing in Figma! 🎨**



