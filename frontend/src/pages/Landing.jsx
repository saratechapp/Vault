import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, ShieldCheck, Lock, Zap, Sparkles,
  LineChart, Receipt, Target, Bell, Globe2, Star, TrendingUp, AlertTriangle, PiggyBank,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { Button, Card, ProgressBar, SectionHeader, Accordion, Chip } from '../components/ui/index.js';
import { LandingDashboardPreview } from '../components/LandingDashboardPreview.jsx';
import { FadeIn, SlideUp, ScrollReveal, Stagger, StaggerItem } from '../components/motion/index.js';

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-app/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Vault" className="h-9 w-9 rounded-xl shadow-glow" />
          <span className="font-display text-lg font-bold text-fg">Vault</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
          <a href="#features" className="link-underline hover:text-fg">Features</a>
          <a href="#ai" className="link-underline hover:text-fg">AI insights</a>
          <a href="#product" className="link-underline hover:text-fg">Product</a>
          <a href="#faq" className="link-underline hover:text-fg">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button as={Link} to="/login" variant="ghost" size="sm">Sign in</Button>
          <Button as={Link} to="/signup" size="sm" rightIcon={<ArrowRight size={15} />}>Get started</Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-16 pt-20">
      <div className="grid-bg absolute inset-0 -z-10" />
      <div className="mx-auto max-w-4xl text-center">
        <SlideUp>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-500">
            <Sparkles size={12} /> New: AI-powered spending insights
          </span>
        </SlideUp>
        <SlideUp delay={0.05}>
          <h1 className="mt-6 font-display text-5xl font-extrabold leading-tight sm:text-6xl">
            <span className="heading-gradient">Your money,</span>
            <br />
            <span className="text-fg">beautifully managed.</span>
          </h1>
        </SlideUp>
        <SlideUp delay={0.1}>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            Vault is the personal finance workspace built for people who care about the details.
            Track every dollar, hit every goal, and finally understand where your money goes — without the spreadsheets.
          </p>
        </SlideUp>
        <SlideUp delay={0.15}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button as={Link} to="/signup" size="lg" rightIcon={<ArrowRight size={16} />}>Start free — no card required</Button>
            <Button as={Link} to="/login" variant="outline" size="lg">Live demo</Button>
          </div>
        </SlideUp>
        <SlideUp delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-subtle">
            <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-success" /> Bank-grade encryption</span>
            <span className="flex items-center gap-1.5"><Lock size={15} className="text-success" /> Your data stays yours</span>
            <span className="flex items-center gap-1.5"><Zap size={15} className="text-success" /> Set up in 60 seconds</span>
          </div>
        </SlideUp>
      </div>

      <ScrollReveal delay={0.1} className="mx-auto mt-14 max-w-5xl" amount={0.15}>
        <LandingDashboardPreview />
      </ScrollReveal>
    </section>
  );
}

function Logos() {
  const names = ['Northline', 'Halcyon', 'Pinecrest', 'Meridian Bank', 'Aster Labs', 'BrightVault'];
  return (
    <section className="border-y border-line py-8">
      <div className="mx-auto max-w-[1400px] px-6 text-center">
        <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-subtle">Trusted by finance-forward teams and individuals</p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm font-semibold uppercase tracking-wide text-subtle">
          {names.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: LineChart, title: 'Cash flow, at a glance', body: 'Understand income, spend and savings across every account with clean, calm visuals.' },
  { icon: Receipt, title: 'CSV import, done right', body: 'Bring in transactions from any bank statement with column mapping and a preview before committing.' },
  { icon: Target, title: 'Goals you actually hit', body: 'Auto-allocate savings, track pace, celebrate milestones — never guess again.' },
  { icon: Bell, title: 'Smart nudges', body: 'Get pinged before you overspend, miss a bill, or drift from your budget.' },
  { icon: ShieldCheck, title: 'Private by default', body: "AES-256 encryption, and a data export that's actually yours. Always." },
  { icon: Globe2, title: 'Multi-currency ready', body: 'Track spend in USD, EUR, GBP, INR and dozens more with live daily conversion.' },
];

function Features() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <SectionHeader
            align="center"
            eyebrow="Features"
            title="Everything you need. Nothing you don't."
            subtitle="Vault replaces spreadsheets, sticky notes and half-baked budgeting apps with one calm, focused workspace."
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

// Dedicated AI showcase — the spec calls for this as its own visual moment,
// distinct from the general feature grid above.
const AI_CARDS = [
  {
    icon: Sparkles, tone: 'text-brand-500 bg-brand-500/15',
    title: 'Daily AI summary', body: '"You\'re pacing 12% under budget this month — on track to hit your Emergency Fund goal 3 weeks early."',
  },
  {
    icon: TrendingUp, tone: 'text-success bg-success/15',
    title: 'Cash flow forecast', body: 'A 7-day, 30-day and month-end balance projection, built from your real spending pattern — not a guess.',
  },
  {
    icon: AlertTriangle, tone: 'text-warning bg-warning/15',
    title: 'Anomaly detection', body: 'Flags the one transaction that looks nothing like your usual pattern, with the specific reason why.',
  },
  {
    icon: PiggyBank, tone: 'text-info bg-info/15',
    title: 'Smart savings suggestions', body: 'Finds spare cash after bills, budgets and goal contributions are accounted for — never a bare-balance guess.',
  },
];

function AIShowcase() {
  return (
    <section id="ai" className="px-6 py-24">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <SectionHeader
            align="center"
            eyebrow="AI insights"
            title="An analyst that never sleeps, built into every account."
            subtitle="Every insight is computed live from your own data — no black box, and every number is one click from the transactions behind it."
          />
        </ScrollReveal>
        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2">
          {AI_CARDS.map((c) => (
            <StaggerItem key={c.title}>
              <Card lift padding="lg" className="flex h-full items-start gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.tone}`}>
                  <c.icon size={20} />
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold text-fg">{c.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{c.body}</p>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

const CHECKLIST = [
  'Real-time cash flow across every account',
  'Category health with clear traffic-light budgets',
  'Bill radar — never miss a due date again',
  'Weekly digest emailed every Monday, 8:00 AM',
];
const HEALTH_BARS = [
  { label: 'Budget adherence', value: 88 },
  { label: 'Savings rate', value: 76 },
  { label: 'Expense diversity', value: 82 },
  { label: 'Income stability', value: 90 },
];

function ProductPreview() {
  return (
    <section id="product" className="px-6 pb-24">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <ScrollReveal>
            <span className="chip border-brand-500/30 bg-brand-500/10 text-xs font-semibold text-brand-500">The dashboard</span>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-fg sm:text-4xl">
              Every number that matters, in one calm view.
            </h2>
            <p className="mt-4 text-muted">
              Balance, budgets, upcoming bills, goal progress and your health score — designed to be glanced at, not studied.
            </p>
            <ul className="mt-6 space-y-3">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-muted">
                  <Check size={16} className="shrink-0 text-success" /> {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button as={Link} to="/signup" rightIcon={<ArrowRight size={15} />}>Try the dashboard</Button>
              <Button as={Link} to="/login" variant="outline">See a live demo</Button>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <Card strong padding="lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-subtle">Financial health</p>
                  <p className="font-display text-2xl font-bold text-fg">82<span className="text-base font-medium text-subtle">/100</span></p>
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
                    <ProgressBar value={b.value} size="xs" className="mt-1.5" />
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
      </div>
    </section>
  );
}

function Metrics() {
  const items = [
    { value: '40,000+', label: 'Active users' },
    { value: '$340M+', label: 'Tracked this year' },
    { value: '4.9 / 5', label: 'App Store rating' },
    { value: '99.99%', label: 'Uptime SLA' },
  ];
  return (
    <section className="border-y border-line bg-tint/[0.02] px-6 py-16">
      <Stagger className="mx-auto grid max-w-[1400px] grid-cols-2 gap-8 text-center sm:grid-cols-4">
        {items.map((it) => (
          <StaggerItem key={it.label}>
            <p className="font-display text-3xl font-bold text-fg">{it.value}</p>
            <p className="mt-1 text-sm text-subtle">{it.label}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function Testimonials() {
  const quotes = [
    { name: 'Priya Menon', role: 'Product Designer', body: "Vault is the first budgeting app that didn't give up on me after week 3. The nudges are so gentle I actually use them." },
    { name: 'Rohit Sen', role: 'Freelance Developer', body: 'Finally understood where my freelance income actually goes. Hit my emergency fund goal 4 months early.' },
    { name: 'Anika Rao', role: 'Startup Founder', body: 'Feels like it was designed by people who actually manage their own money. The dashboard alone is worth it.' },
  ];
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <SectionHeader align="center" eyebrow="Loved by users" title="Reviews from real people managing real money." />
        </ScrollReveal>
        <Stagger className="mt-14 grid gap-5 sm:grid-cols-3">
          {quotes.map((q) => (
            <StaggerItem key={q.name}>
              <Card padding="lg" className="h-full">
                <div className="flex gap-0.5 text-warning">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                </div>
                <p className="mt-3 text-sm text-muted">&ldquo;{q.body}&rdquo;</p>
                <div className="mt-4 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-500">
                    {q.name.split(' ').map((n) => n[0]).join('')}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-fg">{q.name}</p>
                    <p className="text-xs text-subtle">{q.role}</p>
                  </div>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

const FAQS = [
  { question: 'Is my data secure?', answer: 'Yes — your data is encrypted at rest, transmitted over HTTPS, and every write is atomic. You control it end to end.' },
  { question: 'Can I import my existing transactions?', answer: 'Yes, via CSV import with column mapping and a preview before committing.' },
  { question: 'Does it support multiple currencies?', answer: 'Yes — dozens of currencies with live FX rates and per-country defaults.' },
  { question: 'Is Vault really free?', answer: "Yes. Every feature is available on the free plan today — nothing is metered or gated behind a paywall." },
  { question: 'Can I export my data?', answer: 'Yes, any time, in full — from Settings → Data & backups. No lock-in.' },
];

function FAQ() {
  return (
    <section id="faq" className="px-6 py-24">
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

function CTA() {
  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <Card strong padding="lg" className="flex flex-col items-center gap-5 border-brand-500/30 bg-gradient-to-br from-brand-500/10 to-transparent py-16 text-center">
            <h2 className="font-display text-3xl font-bold text-fg">Ready to see your whole financial picture?</h2>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button as={Link} to="/signup" size="lg" rightIcon={<ArrowRight size={16} />}>Create free account</Button>
              <Button as={Link} to="/login" variant="outline" size="lg">Explore demo</Button>
            </div>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line px-6 py-10">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 text-sm text-subtle sm:flex-row">
        <span>© {new Date().getFullYear()} Vault. All rights reserved.</span>
        <div className="flex gap-6">
          <a href="#features" className="hover:text-fg">Features</a>
          <a href="#ai" className="hover:text-fg">AI insights</a>
          <a href="#faq" className="hover:text-fg">FAQ</a>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <FadeIn as="div">
      <Nav />
      <Hero />
      <Logos />
      <Features />
      <AIShowcase />
      <ProductPreview />
      <Metrics />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </FadeIn>
  );
}
