import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Check, ShieldCheck, Lock, Zap, Sparkles, ScanLine,
  LineChart, Target, Globe2, TrendingUp, CalendarDays,
  Wallet, KeyRound, ServerCog, EyeOff, DownloadCloud, Smartphone, Monitor,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { Button, Card, ProgressBar, SectionHeader, Accordion, Chip } from '../components/ui/index.js';
import { LandingDashboardPreview } from '../components/LandingDashboardPreview.jsx';
import { FadeIn, SlideUp, ScrollReveal, Stagger, StaggerItem } from '../components/motion/index.js';
import {
  PhoneFrame, BrowserFrame, CountUp, SpendingHeatmap, AiScanShowcase, MobileAppPreview,
} from '../components/marketing/index.js';

const SEO = {
  title: 'Vault Finance — Smarter Personal Finance Management',
  description:
    'Track spending, manage budgets, scan bills with AI, and understand your finances with Vault Finance across web and mobile.',
};

// The rest of the app is deliberately locked to a 1024px viewport; the
// marketing page is the one place that needs true mobile breakpoints, so it
// swaps the meta on mount and restores it on unmount. Fully scoped to `/`.
function useLandingChrome() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const prevViewport = meta?.getAttribute('content');
    meta?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');

    const prevTitle = document.title;
    document.title = SEO.title;

    let desc = document.querySelector('meta[name="description"]');
    let createdDesc = false;
    if (!desc) {
      desc = document.createElement('meta');
      desc.setAttribute('name', 'description');
      document.head.appendChild(desc);
      createdDesc = true;
    }
    const prevDesc = desc.getAttribute('content');
    desc.setAttribute('content', SEO.description);

    return () => {
      if (prevViewport) meta?.setAttribute('content', prevViewport);
      document.title = prevTitle;
      if (createdDesc) desc.remove();
      else if (prevDesc != null) desc.setAttribute('content', prevDesc);
    };
  }, []);
}

/* ---------------------------------------------------------------- Nav --- */

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-app/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3.5 sm:px-6">
        <Link to="/" className="flex items-center gap-2" aria-label="Vault Finance — home">
          <img src="/logo.svg" alt="" className="h-9 w-9 rounded-xl shadow-glow" />
          <span className="font-display text-lg font-bold text-fg">Vault<span className="text-brand-500"> Finance</span></span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted lg:flex">
          <a href="#features" className="link-underline hover:text-fg">Features</a>
          <a href="#ai" className="link-underline hover:text-fg">AI scanner</a>
          <a href="#platforms" className="link-underline hover:text-fg">Web &amp; Mobile</a>
          <a href="#security" className="link-underline hover:text-fg">Security</a>
          <a href="#faq" className="link-underline hover:text-fg">FAQ</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Button as={Link} to="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</Button>
          <Button as={Link} to="/signup" size="sm" rightIcon={<ArrowRight size={15} />}>Get Started Free</Button>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- Hero --- */

function Hero() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const phoneY = useTransform(scrollY, [0, 700], [0, reduce ? 0 : -48]);

  return (
    <section className="relative overflow-hidden px-4 pb-12 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
      <div className="grid-bg absolute inset-0 -z-10" />
      <div className="mx-auto max-w-3xl text-center">
        <SlideUp>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-500">
            <Sparkles size={12} /> AI bill scanning · Web &amp; Mobile
          </span>
        </SlideUp>
        <SlideUp delay={0.05}>
          <h1 className="mt-6 font-display text-[2.5rem] font-extrabold leading-[1.05] sm:text-6xl">
            <span className="text-fg">Your money, </span>
            <span className="heading-gradient">finally under control.</span>
          </h1>
        </SlideUp>
        <SlideUp delay={0.1}>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted sm:text-lg">
            Track spending, manage budgets, scan bills with AI, and understand your finances —
            all in one secure place, on every device.
          </p>
        </SlideUp>
        <SlideUp delay={0.15}>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Button as={Link} to="/signup" size="lg" fullWidth className="sm:w-auto" rightIcon={<ArrowRight size={16} />}>
              Get Started Free
            </Button>
            <Button as="a" href="#product" variant="outline" size="lg" fullWidth className="sm:w-auto">
              Explore Vault
            </Button>
          </div>
        </SlideUp>
        <SlideUp delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-subtle">
            <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-success" /> Encrypted in transit &amp; at rest</span>
            <span className="flex items-center gap-1.5"><Lock size={15} className="text-success" /> Your data stays yours</span>
            <span className="flex items-center gap-1.5"><Zap size={15} className="text-success" /> Free while in early access</span>
          </div>
        </SlideUp>
      </div>

      {/* Web + Mobile product showcase */}
      <ScrollReveal delay={0.1} amount={0.1} className="relative mx-auto mt-14 max-w-5xl lg:mt-16">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-subtle">
          One Vault account. Your finances everywhere.
        </p>
        <div className="relative lg:pr-10">
          <div className="lg:relative">
            <BrowserFrame>
              <LandingDashboardPreview header={false} />
            </BrowserFrame>
            <motion.div
              style={{ y: phoneY }}
              className="mx-auto mt-8 w-[210px] lg:absolute lg:-bottom-10 lg:-right-6 lg:mt-0"
            >
              <PhoneFrame float floatDelay={0.4}>
                <MobileAppPreview variant="dashboard" />
              </PhoneFrame>
            </motion.div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

/* ------------------------------------------------------- Value strip --- */

const VALUES = [
  { icon: Sparkles, title: 'AI-powered insights', body: 'Every number computed live from your own data.' },
  { icon: Wallet, title: 'Everything in one place', body: 'Accounts, cards, cash, budgets, bills, goals & debts.' },
  { icon: ShieldCheck, title: 'Secure & private', body: 'Scoped access, encrypted storage, export any time.' },
  { icon: Globe2, title: 'Web + Mobile', body: 'Start on the web, continue on your phone.' },
];

function ValueStrip() {
  return (
    <section className="border-y border-line bg-tint/[0.02] py-10">
      <Stagger className="mx-auto grid max-w-[1400px] gap-6 px-4 sm:px-6 md:grid-cols-4">
        {VALUES.map((v) => (
          <StaggerItem key={v.title} className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/12 text-brand-500">
              <v.icon size={18} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-fg">{v.title}</p>
              <p className="mt-0.5 text-sm text-muted">{v.body}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

/* ---------------------------------------------------------- Why Vault --- */

const FEATURES = [
  { icon: LineChart, title: 'Smart tracking', body: 'Track income, expenses and transfers effortlessly across every account, card and wallet.' },
  { icon: ScanLine, title: 'AI bill scanner', body: 'Upload a bill, receipt or payment screenshot and let AI extract the merchant, amount, date and category automatically.' },
  { icon: TrendingUp, title: 'Spending insights', body: 'Understand where your money goes with clear visualizations, category health and month-over-month analysis.' },
  { icon: Target, title: 'Budgets & goals', body: 'Set category budgets, create savings goals and watch your pace toward each one in real time.' },
  { icon: CalendarDays, title: 'Calendar', body: 'See your financial activity day by day, with the net amount for each date front and centre.' },
  { icon: Globe2, title: 'Web + Mobile', body: 'One account, the same data, on the web app and the mobile app — wherever you are.' },
];

function WhyVault() {
  return (
    <section id="features" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <SectionHeader
            align="center"
            eyebrow="01 · Understand"
            title="Everything you need to understand your money."
            subtitle="Vault replaces spreadsheets, sticky notes and half-finished budgeting apps with one calm, focused workspace."
          />
        </ScrollReveal>
        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <StaggerItem key={f.title}>
              <Card lift padding="lg" className="h-full">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                  <f.icon size={20} />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-fg">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{f.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- AI scanner --- */

function AiSection() {
  return (
    <section id="ai" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[1100px]">
        <ScrollReveal>
          <SectionHeader
            align="center"
            eyebrow="02 · Capture"
            title="Snap a bill. Get a transaction."
            subtitle="Point Vault at a receipt or a payment screenshot. AI reads the merchant, amount, date and category, and drops a ready-to-save transaction into your ledger — you just confirm."
          />
        </ScrollReveal>
        <ScrollReveal delay={0.1} className="mt-12">
          <Card strong padding="lg">
            <AiScanShowcase />
          </Card>
        </ScrollReveal>
        <Stagger className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          {[
            'Up to 4 images per scan',
            'Line items + a spending summary extracted',
            'Nothing is posted without your confirmation',
          ].map((t) => (
            <StaggerItem key={t} className="flex items-center gap-2 rounded-xl border border-line bg-tint/[0.02] px-3 py-2.5 text-muted">
              <Check size={15} className="shrink-0 text-success" /> {t}
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Heatmap --- */

function HeatmapSection() {
  return (
    <section className="border-y border-line bg-tint/[0.02] px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-2 lg:items-center">
        <ScrollReveal className="min-w-0">
          <span className="chip border-brand-500/30 bg-brand-500/10 text-xs font-semibold text-brand-500">03 · See</span>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-fg sm:text-4xl">
            See your spending patterns at a glance.
          </h2>
          <p className="mt-4 text-muted">
            Every day you spend is a cell, shaded by how much left your accounts. Heavy weeks, quiet weeks
            and the run-up to payday all surface instantly — the same view the in-app calendar builds from your real transactions.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <p className="font-display text-2xl font-bold text-fg"><CountUp value={112} />d</p>
              <p className="text-xs text-subtle">of activity shown</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-fg"><CountUp value={8} /></p>
              <p className="text-xs text-subtle">categories tracked</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-success">
                <CountUp value={34.9} decimals={1} suffix="%" />
              </p>
              <p className="text-xs text-subtle">savings rate</p>
            </div>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.1} className="min-w-0">
          <Card strong padding="lg">
            <p className="text-xs font-semibold text-subtle">Spending activity · last 16 weeks</p>
            <SpendingHeatmap className="mt-4" />
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}

/* --------------------------------------------------- Web + Mobile --- */

function Platforms() {
  return (
    <section id="platforms" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <SectionHeader
            align="center"
            eyebrow="04 · Everywhere"
            title="Your finances, wherever you are."
            subtitle="Start on the web. Continue on your phone. Your financial life stays connected."
          />
        </ScrollReveal>

        <div className="mt-14 space-y-12">
          <ScrollReveal className="mx-auto max-w-3xl">
            <BrowserFrame url="app.vaultfinance.com/dashboard">
              <LandingDashboardPreview header={false} />
            </BrowserFrame>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-10">
              <div className="w-[200px] sm:w-[220px]">
                <PhoneFrame label="Dashboard">
                  <MobileAppPreview variant="dashboard" />
                </PhoneFrame>
              </div>
              <div className="w-[200px] sm:w-[220px]">
                <PhoneFrame label="Transactions" float floatDelay={0.6}>
                  <MobileAppPreview variant="transactions" />
                </PhoneFrame>
              </div>
              <div className="w-[200px] sm:w-[220px]">
                <PhoneFrame label="Calendar">
                  <MobileAppPreview variant="calendar" />
                </PhoneFrame>
              </div>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal className="mt-12 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6 text-sm font-medium text-muted">
            <span className="flex items-center gap-2"><Monitor size={16} className="text-brand-500" /> Web app</span>
            <span className="flex items-center gap-2"><Smartphone size={16} className="text-brand-500" /> Mobile app</span>
          </div>
          <Button as={Link} to="/signup" size="lg" rightIcon={<ArrowRight size={16} />}>Get Started Free</Button>
        </ScrollReveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- How it works --- */

const STEPS = [
  { n: '01', title: 'Add', body: 'Add transactions manually, import a CSV, or scan bills and payment screenshots with AI.' },
  { n: '02', title: 'Understand', body: 'Vault categorizes your spending and surfaces insights, budgets pace and cash-flow trends.' },
  { n: '03', title: 'Improve', body: 'Use budgets, goals and reports to make better financial decisions — and watch the progress compound.' },
];

function HowItWorks() {
  return (
    <section className="border-y border-line bg-tint/[0.02] px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <SectionHeader align="center" eyebrow="05 · Improve" title="Three steps to a clearer picture." />
        </ScrollReveal>
        <Stagger className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <StaggerItem key={s.n}>
              <Card padding="lg" className="h-full">
                <span className="font-display text-4xl font-extrabold text-brand-500/25">{s.n}</span>
                <h3 className="mt-2 font-display text-lg font-bold text-fg">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{s.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Security --- */

const SECURITY = [
  { icon: KeyRound, title: 'Secure authentication', body: 'Sign-in, sessions and JWTs are handled by Supabase Auth, with email-OTP two-factor step-up on new devices.' },
  { icon: ShieldCheck, title: 'Scoped access', body: 'Every API request is verified server-side and every query is scoped to your user — you only ever touch your own data.' },
  { icon: ServerCog, title: 'Protected API', body: 'Rate limiting, an allow-listed CORS policy, secure HTTP headers and server-side validation on every route.' },
  { icon: Lock, title: 'Encrypted storage & transport', body: 'Data lives in Supabase Postgres, encrypted at rest, and travels over HTTPS.' },
  { icon: EyeOff, title: 'Privacy-focused', body: 'No third-party ad tracking. A PIN lock and idle sign-out keep the app private on shared devices.' },
  { icon: DownloadCloud, title: 'No lock-in', body: 'Export everything, or delete everything, from Settings whenever you want.' },
];

function Security() {
  return (
    <section id="security" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <SectionHeader
            align="center"
            eyebrow="Security"
            title="Your financial data deserves protection."
            subtitle="Vault is built on a small number of solid, verifiable practices — described plainly, with no inflated claims."
          />
        </ScrollReveal>
        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY.map((s) => (
            <StaggerItem key={s.title}>
              <Card padding="lg" className="h-full">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/12 text-success">
                  <s.icon size={20} />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-fg">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{s.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ----------------------------------------------------- Dashboard deep --- */

const CHECKLIST = [
  'Real-time balance, income and expenses across every account',
  'Category health with clear traffic-light budgets',
  'Upcoming bills, so a due date never slips',
  'Goal progress and a weekly spending summary in-app',
];
const HEALTH_BARS = [
  { label: 'Budget adherence', value: 88 },
  { label: 'Savings rate', value: 76 },
  { label: 'Expense diversity', value: 82 },
  { label: 'Income stability', value: 90 },
];

function DashboardDeep() {
  return (
    <section id="product" className="border-y border-line bg-tint/[0.02] px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-2 lg:items-center">
        <ScrollReveal>
          <span className="chip border-brand-500/30 bg-brand-500/10 text-xs font-semibold text-brand-500">The dashboard</span>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-fg sm:text-4xl">
            Every number that matters, in one calm view.
          </h2>
          <p className="mt-4 text-muted">
            Balance, budgets, upcoming bills, goal progress and a health score — a customizable, drag-to-reorder
            layout designed to be glanced at, not studied.
          </p>
          <ul className="mt-6 space-y-3">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted">
                <Check size={16} className="mt-0.5 shrink-0 text-success" /> {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button as={Link} to="/signup" rightIcon={<ArrowRight size={15} />}>Try the dashboard</Button>
            <Button as={Link} to="/login" variant="outline">Sign in</Button>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <Card strong padding="lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-subtle">Financial health</p>
                <p className="font-display text-2xl font-bold text-fg">
                  <CountUp value={82} /><span className="text-base font-medium text-subtle">/100</span>
                </p>
              </div>
              <Chip tone="success">Grade A-</Chip>
            </div>
            <div className="mt-5 space-y-3">
              {HEALTH_BARS.map((b) => (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{b.label}</span>
                    <span className="font-semibold text-fg">{b.value}</span>
                  </div>
                  <ProgressBar value={b.value} tone="success" size="xs" className="mt-1.5" />
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-line p-3 text-center">
                <p className="text-xs text-subtle">Categories</p>
                <p className="mt-1 font-display text-base font-bold text-fg">8</p>
              </div>
              <div className="rounded-xl border border-line p-3 text-center">
                <p className="text-xs text-subtle">Budgets</p>
                <p className="mt-1 font-display text-base font-bold text-fg">8 active</p>
              </div>
              <div className="rounded-xl border border-line p-3 text-center">
                <p className="text-xs text-subtle">Goals</p>
                <p className="mt-1 font-display text-base font-bold text-fg">3 on track</p>
              </div>
            </div>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Principles --- */

const PRINCIPLES = [
  { icon: Sparkles, title: 'Insight over noise', body: 'Every insight is computed from your own data and links straight to the transactions behind it. No black box.' },
  { icon: ShieldCheck, title: 'Privacy over growth hacks', body: 'No ad tracking, no selling data. Your finances are yours, and the export button proves it.' },
  { icon: Zap, title: 'Calm over clutter', body: 'A focused, glanceable interface — the opposite of a dashboard that needs a manual.' },
];

function Principles() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <SectionHeader align="center" eyebrow="Why us" title="Built on principles, not hype." />
        </ScrollReveal>
        <Stagger className="mt-14 grid gap-5 md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <StaggerItem key={p.title}>
              <Card lift padding="lg" className="h-full">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                  <p.icon size={20} />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-fg">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{p.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- Pricing / CTA --- */

function Pricing() {
  return (
    <section className="px-4 pb-8 sm:px-6">
      <ScrollReveal className="mx-auto max-w-[1400px]">
        <Card strong padding="lg" className="flex flex-col items-center gap-3 border-brand-500/25 bg-gradient-to-br from-brand-500/[0.08] to-transparent py-12 text-center">
          <span className="chip border-brand-500/30 bg-brand-500/10 text-xs font-semibold text-brand-500">Pricing</span>
          <h2 className="font-display text-2xl font-bold text-fg sm:text-3xl">Start free. Upgrade when you need more.</h2>
          <p className="max-w-xl text-muted">
            Every feature is available for free while Vault is in early access. A paid plan is planned — if it launches,
            you'll be told first, and existing free access is unaffected.
          </p>
          <Button as={Link} to="/signup" size="lg" className="mt-2" rightIcon={<ArrowRight size={16} />}>
            View plans &amp; get started
          </Button>
        </Card>
      </ScrollReveal>
    </section>
  );
}

const FAQS = [
  { question: 'Is my data secure?', answer: 'Your data is encrypted at rest in Supabase Postgres and transmitted over HTTPS. Every request is verified server-side and scoped to your account only, with rate limiting and secure headers in front. You can export or delete everything at any time.' },
  { question: 'How does the AI bill scanner work?', answer: 'Upload up to four photos of a bill, receipt or payment screenshot. AI extracts the merchant, amount, date, category and line items, and prepares a transaction — nothing is saved to your ledger until you confirm it.' },
  { question: 'Is Vault really available on both web and mobile?', answer: 'Yes. The web app and the mobile app share one account and the same backend, so your data is identical wherever you sign in.' },
  { question: 'Can I import my existing transactions?', answer: 'Yes, via CSV import with column mapping and a preview before anything is committed.' },
  { question: 'Does it support multiple currencies?', answer: 'Yes — dozens of currencies with live daily FX conversion against your base currency.' },
  { question: 'How much does Vault cost?', answer: 'Every feature is free today. A paid plan is planned; if it launches, existing free access is unaffected and you will always be told before anything changes.' },
];

function FAQ() {
  return (
    <section id="faq" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <ScrollReveal>
          <SectionHeader align="center" eyebrow="FAQ" title="Questions, answered" />
        </ScrollReveal>
        <ScrollReveal delay={0.1} className="mt-10">
          <Accordion items={FAQS} />
        </ScrollReveal>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <Card strong padding="lg" className="relative flex flex-col items-center gap-5 overflow-hidden border-brand-500/30 py-16 text-center">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]" />
            <h2 className="relative font-display text-3xl font-bold text-fg sm:text-4xl">Take control of your money today.</h2>
            <p className="relative max-w-xl text-muted">Track smarter. Understand better. Build a healthier financial future.</p>
            <div className="relative flex flex-col items-center gap-3 sm:flex-row">
              <Button as={Link} to="/signup" size="lg" rightIcon={<ArrowRight size={16} />}>Get Started Free</Button>
              <Button as={Link} to="/signup" variant="outline" size="lg">View Plans</Button>
            </div>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Footer --- */

const FOOTER = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'AI bill scanner', href: '#ai' },
      { label: 'Spending insights', href: '#product' },
      { label: 'Budgets & goals', href: '#features' },
      { label: 'Calendar', href: '#features' },
      { label: 'Pricing', to: '/signup' },
    ],
  },
  {
    heading: 'Platforms',
    links: [
      { label: 'Web app', href: '#platforms' },
      { label: 'Mobile app', href: '#platforms' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Why Vault', href: '#product' },
      { label: 'Security', href: '#security' },
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Log in', to: '/login' },
      { label: 'Sign up', to: '/signup' },
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-line px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link to="/" className="flex items-center gap-2" aria-label="Vault Finance — home">
              <img src="/logo.svg" alt="" className="h-8 w-8 rounded-xl" />
              <span className="font-display text-base font-bold text-fg">Vault Finance</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted">
              Your entire financial life inside one Vault — on web and mobile.
            </p>
          </div>
          {FOOTER.map((col) => (
            <div key={col.heading}>
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle">{col.heading}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.to ? (
                      <Link to={l.to} className="text-muted hover:text-fg">{l.label}</Link>
                    ) : (
                      <a href={l.href} className="text-muted hover:text-fg">{l.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-sm text-subtle sm:flex-row">
          <span>© {new Date().getFullYear()} Vault Finance. All rights reserved.</span>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-fg">Privacy</Link>
            <Link to="/terms" className="hover:text-fg">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------- Page --- */

export default function Landing() {
  useLandingChrome();
  return (
    <FadeIn as="div">
      <Nav />
      <Hero />
      <ValueStrip />
      <WhyVault />
      <AiSection />
      <HeatmapSection />
      <Platforms />
      <HowItWorks />
      <Security />
      <DashboardDeep />
      <Principles />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </FadeIn>
  );
}
