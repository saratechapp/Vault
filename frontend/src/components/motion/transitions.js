// Shared timing/easing so every animation in the app feels like one system
// instead of each page inventing its own. Deliberately restrained — premium
// SaaS motion is quick and settles fast, never bouncy or attention-seeking.
export const EASE = [0.16, 1, 0.3, 1]; // easeOutExpo-ish, matches the existing viewIn keyframe in index.css
export const DURATION = { fast: 0.18, base: 0.32, slow: 0.5 };
