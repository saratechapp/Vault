import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PinLockScreen from '../PinLockScreen.jsx';
import { verifyPin } from '../../lib/pin.js';

vi.mock('../../lib/pin.js', () => ({ verifyPin: vi.fn() }));

const logout = vi.fn();
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { name: 'Jane Doe' }, logout }),
}));

function dotsContainer(container) {
  return container.querySelector('.mt-8.flex.gap-3');
}

async function pressDigits(user, digits) {
  for (const d of digits) {
    // eslint-disable-next-line no-await-in-loop
    await user.click(screen.getByRole('button', { name: d }));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

// globals: false in vite.config.js means @testing-library/react's
// auto-cleanup (which only self-registers if it detects a *global*
// afterEach) never kicks in, so each render() leaks its DOM into the next
// test unless cleaned up explicitly.
afterEach(cleanup);

describe('PinLockScreen', () => {
  it('auto-submits at 4 digits with no submit button, and unlocks on a correct PIN', async () => {
    verifyPin.mockResolvedValue(true);
    const onUnlock = vi.fn();
    const user = userEvent.setup();
    render(<PinLockScreen onUnlock={onUnlock} />);

    // There is no submit button anywhere in this component.
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();

    await pressDigits(user, '1234');

    await waitFor(() => expect(verifyPin).toHaveBeenCalledWith('1234'));
    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
  });

  it('does not verify before the 4-digit minimum is reached', async () => {
    const user = userEvent.setup();
    render(<PinLockScreen onUnlock={vi.fn()} />);

    await pressDigits(user, '123');
    // Give the (would-be) debounce a chance to fire if it incorrectly did.
    await new Promise((r) => { setTimeout(r, 300); });

    expect(verifyPin).not.toHaveBeenCalled();
  });

  it('shakes and clears the entry on an incorrect PIN, without unlocking', async () => {
    verifyPin.mockResolvedValue(false);
    const onUnlock = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<PinLockScreen onUnlock={onUnlock} />);

    await pressDigits(user, '9999');

    await waitFor(() => expect(verifyPin).toHaveBeenCalledWith('9999'));
    await waitFor(() => expect(dotsContainer(container).className).toContain('animate-pulse'));

    expect(onUnlock).not.toHaveBeenCalled();
    // Entry is cleared on failure — no dot should be showing as filled.
    const dots = dotsContainer(container).querySelectorAll('span');
    dots.forEach((dot) => {
      expect(dot.className).not.toContain('bg-brand-500');
      expect(dot.className).not.toContain('bg-rose-500');
    });

    // The shake resets after ~400ms.
    await waitFor(() => expect(dotsContainer(container).className).not.toContain('animate-pulse'), { timeout: 1000 });
  });

  it('auto-submits immediately (no extra debounce) once 6 digits are entered', async () => {
    verifyPin.mockResolvedValue(true);
    const onUnlock = vi.fn();
    const user = userEvent.setup();
    render(<PinLockScreen onUnlock={onUnlock} />);

    await pressDigits(user, '123456');

    await waitFor(() => expect(verifyPin).toHaveBeenCalledWith('123456'));
    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
  });

  it('calls logout when the sign-out button is pressed', async () => {
    const user = userEvent.setup();
    render(<PinLockScreen onUnlock={vi.fn()} />);

    // The logout button is icon-only; find it as the extra button in the
    // 3x4 keypad grid that isn't a digit or the backspace/delete key.
    const buttons = screen.getAllByRole('button');
    const logoutButton = buttons.find((b) => !/^[0-9]$/.test(b.textContent) && b.textContent === '');
    expect(logoutButton).toBeTruthy();
    await user.click(logoutButton);

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
