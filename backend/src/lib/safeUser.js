const plans = require('../plans');

// Reproduces the exact response shape the old file-store's safeUser() sent
// (id, name, email, phone, avatar, currency, currencySymbol, memberSince,
// plan, healthScore, healthGrade, twoFactorEnabled, biometricEnabled) —
// email now comes from the verified Supabase Auth user, everything else
// from the profiles row.
function buildSafeUser(userId, email, profile, impersonation, isAdmin) {
  const planConfig = plans.getPlanConfig(profile?.plan);
  return {
    id: userId,
    name: profile?.name ?? '',
    email,
    phone: profile?.phone ?? '',
    avatar: profile?.avatar ?? '',
    currency: profile?.currency ?? 'INR',
    currencySymbol: profile?.currencySymbol ?? '₹',
    country: profile?.country ?? null,
    memberSince: profile?.memberSince ?? null,
    plan: profile?.plan ?? 'Free',
    healthScore: profile?.healthScore ?? 0,
    healthGrade: profile?.healthGrade ?? '—',
    twoFactorEnabled: !!profile?.twoFactorEnabled,
    biometricEnabled: !!profile?.biometricEnabled,
    // Our own source of truth for "can this account log in with a password"
    // — see POST /api/me/password-set and 0003_has_password.sql for why this
    // isn't derived from Supabase's identities/AMR data.
    hasPassword: !!profile?.hasPassword,
    feedbackPromptSnoozedUntil: profile?.feedbackPromptSnoozedUntil ?? null,
    feedbackPromptDisabled: !!profile?.feedbackPromptDisabled,
    themeMode: profile?.themeMode ?? 'system',
    language: profile?.language ?? 'en',
    weekStart: profile?.weekStart ?? 'system',
    timeFormat: profile?.timeFormat ?? 'system',
    hapticEnabled: profile?.hapticEnabled ?? true,
    reminderSettings: profile?.reminderSettings ?? null,
    // Resolved once here from plans.js (the single source of truth) so the
    // frontend never needs its own copy of plan/feature rules. limits uses
    // null (not Infinity — JSON can't represent it) to mean "no limit".
    features: planConfig.features,
    limits: plans.serializableLimits(profile?.plan),
    // Drives the consumer app's impersonation banner (ImpersonationBanner.jsx)
    // — null when nobody is impersonating this account right now.
    impersonation: impersonation
      ? { active: true, adminName: impersonation.adminName, expiresAt: impersonation.expiresAt, sessionId: impersonation.id }
      : null,
    // Drives the "Super Admin" button in the consumer app's Topbar — only
    // ever a UI-visibility signal, never an authorization decision (see
    // requireAuth's comment on req.isAdmin).
    isAdmin: !!isAdmin,
  };
}

module.exports = { buildSafeUser };
