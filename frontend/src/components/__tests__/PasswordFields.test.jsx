import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordFields from '../PasswordFields.jsx';

// globals: false in vite.config.js means @testing-library/react's
// auto-cleanup (which only self-registers if it detects a *global*
// afterEach) never kicks in, so each render() leaks its DOM into the next
// test unless cleaned up explicitly.
afterEach(cleanup);

// PasswordFields is fully controlled — wrap it in a small stateful harness
// so typing actually flows back through password/setPassword, confirm/setConfirm.
function Harness(props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  return <PasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} {...props} />;
}

const PW_PLACEHOLDER = 'At least 8 characters';

describe('PasswordFields', () => {
  it('shows a length hint once a short password is typed', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText(PW_PLACEHOLDER), '123');

    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
  });

  it('shows a mismatch hint when confirm differs from password', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText(PW_PLACEHOLDER), 'abcdef12');
    await user.type(screen.getByPlaceholderText('Re-enter password'), 'abcxyz34');

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(screen.queryByText('Passwords match.')).not.toBeInTheDocument();
  });

  it('clears both hints and shows a match confirmation once values are equal and long enough', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText(PW_PLACEHOLDER), 'abcdef12');
    await user.type(screen.getByPlaceholderText('Re-enter password'), 'abcdef12');

    expect(screen.queryByText('Password must be at least 8 characters.')).not.toBeInTheDocument();
    expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument();
    expect(screen.getByText('Passwords match.')).toBeInTheDocument();
  });

  it('does not show a match/mismatch hint until something is typed into confirm', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText(PW_PLACEHOLDER), 'abcdef12');

    expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument();
    expect(screen.queryByText('Passwords match.')).not.toBeInTheDocument();
  });

  it('uses the custom passwordLabel prop for the first field label', () => {
    render(<Harness passwordLabel="New password" />);
    expect(screen.getByText('New password')).toBeInTheDocument();
  });

  it('both fields render as type="password" (no show/hide toggle exists in this component)', () => {
    render(<Harness />);
    const passwordInput = screen.getByPlaceholderText(PW_PLACEHOLDER);
    const confirmInput = screen.getByPlaceholderText('Re-enter password');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('type', 'password');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
