// Shared by every "set/create/reset password" form (CreatePassword.jsx,
// ResetPassword.jsx, Settings.jsx's PasswordModal) so the rule lives in one
// place instead of being retyped — and potentially drifting — at each spot.
//
// Modern guidance (NIST 800-63B) favours length over forced composition, so
// the rule is: at least 8 characters, and not a trivially weak string
// (all one character, or a pure run of digits like "12345678").
const MIN_LENGTH = 8;

function isTrivial(password) {
  if (/^(.)\1+$/.test(password)) return true; // "aaaaaaaa"
  if (/^\d+$/.test(password)) return true; // "12345678"
  return false;
}

export function isPasswordValid(password, confirm) {
  return password.length >= MIN_LENGTH && !isTrivial(password) && password === confirm;
}

export function passwordValidationError(password, confirm) {
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters.`;
  if (isTrivial(password)) return 'Choose a less predictable password.';
  if (password !== confirm) return 'Passwords do not match.';
  return '';
}
