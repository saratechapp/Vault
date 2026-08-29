// Single source of truth for subscription plans, limits, and feature flags.
// Nothing outside this file should ever compare a plan name or hardcode a
// limit/flag value — every enforcement point calls can()/limitFor() so that
// introducing or tuning a paid tier later is a config edit here, not a
// codebase change.
//
// MVP state: everyone is on `free`, and `free` is fully unlocked (every
// feature true, every limit Infinity) — that's the actual current product
// decision, not a placeholder. pro/premium/enterprise exist as ready-to-tune
// templates with illustrative differentiation, since there's no billing yet
// to make their real numbers meaningful.
const PLANS = {
  free: {
    label: 'Free',
    limits: {
      accounts: Infinity,
      budgets: Infinity,
      goals: Infinity,
      transactions: Infinity,
      aiRequestsPerDay: Infinity,
    },
    features: {
      canUseAIInsights: true,
      canUseAIReports: true,
      canUseAdvancedAnalytics: true,
      canCreateUnlimitedAccounts: true,
      canExportPDF: true,
      canUseOCR: true,
      canUploadAttachments: true,
      canCloudBackup: true,
    },
  },
  // Illustrative only until billing exists — tune freely, no code changes
  // needed elsewhere when these numbers change.
  pro: {
    label: 'Pro',
    limits: {
      accounts: 10,
      budgets: 25,
      goals: 25,
      transactions: Infinity,
      aiRequestsPerDay: 50,
    },
    features: {
      canUseAIInsights: true,
      canUseAIReports: true,
      canUseAdvancedAnalytics: true,
      canCreateUnlimitedAccounts: false,
      canExportPDF: true,
      canUseOCR: false,
      canUploadAttachments: true,
      canCloudBackup: false,
    },
  },
  premium: {
    label: 'Premium',
    limits: {
      accounts: Infinity,
      budgets: Infinity,
      goals: Infinity,
      transactions: Infinity,
      aiRequestsPerDay: 200,
    },
    features: {
      canUseAIInsights: true,
      canUseAIReports: true,
      canUseAdvancedAnalytics: true,
      canCreateUnlimitedAccounts: true,
      canExportPDF: true,
      canUseOCR: true,
      canUploadAttachments: true,
      canCloudBackup: true,
    },
  },
  enterprise: {
    label: 'Enterprise',
    limits: {
      accounts: Infinity,
      budgets: Infinity,
      goals: Infinity,
      transactions: Infinity,
      aiRequestsPerDay: Infinity,
    },
    features: {
      canUseAIInsights: true,
      canUseAIReports: true,
      canUseAdvancedAnalytics: true,
      canCreateUnlimitedAccounts: true,
      canExportPDF: true,
      canUseOCR: true,
      canUploadAttachments: true,
      canCloudBackup: true,
    },
  },
};

function getPlanConfig(planKey) {
  const key = String(planKey || 'free').toLowerCase();
  return PLANS[key] || PLANS.free;
}

function can(planKey, featureFlag) {
  return !!getPlanConfig(planKey).features[featureFlag];
}

function limitFor(planKey, limitKey) {
  const value = getPlanConfig(planKey).limits[limitKey];
  return value === undefined ? Infinity : value;
}

// JSON.stringify silently turns Infinity into null with no explanation —
// for API responses, make that explicit instead of accidental: null means
// "no limit" by contract, documented for whatever reads /api/me's `limits`.
function serializableLimits(planKey) {
  const { limits } = getPlanConfig(planKey);
  return Object.fromEntries(
    Object.entries(limits).map(([key, value]) => [key, value === Infinity ? null : value])
  );
}

module.exports = { PLANS, getPlanConfig, can, limitFor, serializableLimits };
