// Shared by every "set/create/reset password" form (CreatePassword.jsx,
// ResetPassword.jsx, Settings.jsx's PasswordModal) so the rule lives in one
// place instead of being retyped — and potentially drifting — at each spot.
export function isPasswordValid(password, confirm) {
  return password.length >= 6 && password === confirm;
}

export function passwordValidationError(password, confirm) {
  if (password.length < 6) return 'Password must be at least 6 characters.';
  if (password !== confirm) return 'Passwords do not match.';
  return '';
}
