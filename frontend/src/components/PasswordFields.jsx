import { Lock } from 'lucide-react';
import { Field, Input } from './ui/index.js';
import { passwordValidationError } from '../lib/passwordValidation.js';

// Password + confirm-password field pair shared by CreatePassword and
// ResetPassword — same inputs, same length/match hints, only the first
// field's label differs between the two flows.
export function PasswordFields({ passwordLabel = 'Password', password, setPassword, confirm, setConfirm }) {
  const pwError = password.length > 0 ? passwordValidationError(password, password) : '';
  const matched = confirm.length > 0 && password === confirm && !pwError;
  return (
    <>
      <Field label={passwordLabel}>
        <Input leftIcon={<Lock size={15} />} type="password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        {pwError && <p className="mt-1 text-xs text-danger">{pwError}</p>}
      </Field>
      <Field label="Confirm password">
        <Input leftIcon={<Lock size={15} />} type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" />
        {confirm.length > 0 && password !== confirm && (
          <p className="mt-1 text-xs text-danger">Passwords do not match.</p>
        )}
        {matched && <p className="mt-1 text-xs text-success">Passwords match.</p>}
      </Field>
    </>
  );
}

export default PasswordFields;
