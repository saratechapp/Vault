import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Plain-language Terms of Service and Privacy Policy. These describe the
// product's actual data practices (Supabase Postgres + Supabase Auth, no
// third-party ad tracking, full export/delete on request). They are written
// to be accurate and usable, but a lawyer should review them against the
// jurisdictions you operate in before a public launch — the copy says so.

const LAST_UPDATED = 'September 2026';

function LegalShell({ title, children }) {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-14">
      <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft size={14} /> Back to home
      </Link>
      <h1 className="font-display text-3xl font-bold text-fg">{title}</h1>
      <p className="mt-1.5 text-sm text-subtle">Last updated: {LAST_UPDATED}</p>
      <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-muted [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fg [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
      <p className="mt-12 rounded-xl border border-line bg-tint/[0.03] p-4 text-xs text-subtle">
        This document is provided in good faith and describes how Vault actually works today. It is not a substitute for
        legal advice; it should be reviewed by qualified counsel for your jurisdiction before you rely on it commercially.
      </p>
    </div>
  );
}

export function Terms() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        These terms govern your use of Vault (&ldquo;the Service&rdquo;), a personal-finance tracking application. By
        creating an account or using the Service you agree to them. If you do not agree, do not use the Service.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must provide a valid email address and are responsible for keeping your credentials secure.</li>
        <li>You are responsible for all activity under your account. Tell us promptly if you suspect unauthorized access.</li>
        <li>You must be legally able to enter a contract in your jurisdiction to use the Service.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to access other users&rsquo; data, probe or disrupt the Service, or bypass rate limits and security controls.</li>
        <li>Do not use the Service for anything unlawful, or to store content you have no right to store.</li>
        <li>Automated access outside documented APIs, and reselling the Service, are not permitted.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        You own the financial data you enter. You can export a complete copy at any time from Settings &rarr; Data &amp;
        backups, and you can delete your account and its data from Settings. See the <Link to="/privacy" className="text-brand-500 link-underline">Privacy Policy</Link> for how we handle it.
      </p>

      <h2>Financial information disclaimer</h2>
      <p>
        Vault is a tracking and organisation tool. Its calculations, forecasts, health scores and insights are informational
        only and are not financial, tax, investment or legal advice. You are responsible for verifying figures before acting
        on them.
      </p>

      <h2>Availability and changes</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind to the
        extent permitted by law. We may add, change or remove features. If we make a material change to these terms or to
        pricing, we will notify you by email or in the app before it takes effect.
      </p>

      <h2>Pricing</h2>
      <p>
        All features are currently available at no cost. A paid plan may be introduced in future. If it is, you will be told
        in advance, and access you already have will not be removed without notice.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Vault and its operators are not liable for indirect, incidental or
        consequential damages, or for loss of data or profits, arising from your use of the Service. Nothing here excludes
        liability that cannot be excluded by law.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or terminate an account that
        violates these terms, and will make reasonable efforts to let you export your data first where lawful and practical.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: use the in-app feedback form (Settings &rarr; Help &amp; support), category
        &ldquo;General message&rdquo;.
      </p>
    </LegalShell>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This policy explains what Vault collects, why, and what you can do about it. We aim to collect the minimum needed to
        run the Service and we do not sell your data or use it for third-party advertising.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> your email address, and a password (stored only as a salted hash by our authentication provider).</li>
        <li><strong>Profile data you provide:</strong> name, optional phone, country, currency, avatar and preferences.</li>
        <li><strong>Financial data you enter:</strong> accounts, transactions, budgets, bills, goals, debts, categories and notes.</li>
        <li><strong>Operational data:</strong> sign-in events (time, IP, device/user-agent) for security and abuse prevention, and basic error logs.</li>
      </ul>
      <p>We do not connect to your bank. All financial data is entered by you or imported from files you upload.</p>

      <h2>How it is stored and protected</h2>
      <ul>
        <li>Data is held in a managed PostgreSQL database (Supabase), encrypted at rest, with access over TLS.</li>
        <li>Authentication is handled by Supabase Auth. Each request is scoped to your own user id; the app enforces that you can only read and write your own records.</li>
        <li>Access to production systems is limited to operators who need it to run the Service.</li>
      </ul>

      <h2>Third parties we use</h2>
      <ul>
        <li><strong>Supabase</strong> — database, authentication and file storage.</li>
        <li><strong>An exchange-rate provider</strong> — to fetch daily currency conversion rates (no personal data is sent).</li>
        <li><strong>Anthropic</strong> — only if you use the bill/receipt scanner: the image you submit is sent for one-time extraction and is not stored by us; it is not used to train models.</li>
        <li><strong>Payment providers (Stripe / Razorpay)</strong> — only if and when paid plans launch and you choose to subscribe.</li>
      </ul>
      <p>We do not use third-party advertising or analytics trackers.</p>

      <h2>Your rights</h2>
      <ul>
        <li><strong>Access / export:</strong> download a full copy of your data any time from Settings &rarr; Data &amp; backups.</li>
        <li><strong>Correction:</strong> edit any record directly in the app.</li>
        <li><strong>Deletion:</strong> delete your account and all associated data from Settings. Deletion cascades across every table you own.</li>
        <li>Depending on where you live (e.g. under GDPR or CCPA) you may have additional rights; contact us to exercise them.</li>
      </ul>

      <h2>Retention</h2>
      <p>
        We keep your data while your account is active. When you delete your account, your records are removed from the
        primary database promptly; residual copies in encrypted backups age out on the backup rotation schedule.
        AI-assistant conversation history is pruned automatically after a fixed retention window.
      </p>

      <h2>Children</h2>
      <p>The Service is not directed to children under 16, and we do not knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>If we change this policy materially, we will notify you by email or in the app before the change takes effect.</p>

      <h2>Contact</h2>
      <p>
        Privacy questions or requests: use the in-app feedback form (Settings &rarr; Help &amp; support), category
        &ldquo;Security&rdquo; or &ldquo;General message&rdquo;.
      </p>
    </LegalShell>
  );
}
