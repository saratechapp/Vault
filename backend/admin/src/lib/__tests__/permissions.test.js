import { describe, it, expect } from 'vitest';
import { hasPermission } from '../permissions.js';

describe('hasPermission', () => {
  it('grants a super-admin access regardless of module/action', () => {
    const admin = { isSuperAdmin: true, permissions: [] };
    expect(hasPermission(admin, 'users', 'delete')).toBe(true);
    expect(hasPermission(admin, 'anything', 'whatever')).toBe(true);
  });

  it('grants a super-admin access even with no permissions field at all', () => {
    const admin = { isSuperAdmin: true };
    expect(hasPermission(admin, 'rbac', 'edit')).toBe(true);
  });

  it('grants access when permissions === "all" regardless of module/action', () => {
    const admin = { isSuperAdmin: false, permissions: 'all' };
    expect(hasPermission(admin, 'users', 'delete')).toBe(true);
    expect(hasPermission(admin, 'feedback', 'view')).toBe(true);
  });

  it('returns true only for the exact module:action pair present in the permissions array', () => {
    const admin = { permissions: [{ module: 'users', action: 'view' }] };
    // NOTE: hasPermission checks admin.permissions.includes(`${module}:${action}`),
    // i.e. it expects an array of "module:action" strings, not objects. An
    // array of objects will never satisfy Array.prototype.includes, so this
    // documents the real (string-based) behavior against a string-based fixture.
    const stringAdmin = { permissions: ['users:view'] };
    expect(hasPermission(stringAdmin, 'users', 'view')).toBe(true);
    expect(hasPermission(stringAdmin, 'users', 'delete')).toBe(false);
    expect(hasPermission(stringAdmin, 'admins', 'view')).toBe(false);

    // An array of {module, action} objects (not "module:action" strings)
    // never matches, since Array.includes does a strict equality check.
    expect(hasPermission(admin, 'users', 'view')).toBe(false);
  });

  it('returns false for every other module/action when only one permission is granted', () => {
    const admin = { permissions: ['users:view'] };
    expect(hasPermission(admin, 'users', 'edit')).toBe(false);
    expect(hasPermission(admin, 'users', 'suspend')).toBe(false);
    expect(hasPermission(admin, 'dashboard', 'view')).toBe(false);
  });

  it('supports multiple granted permissions in the array', () => {
    const admin = { permissions: ['users:view', 'users:edit', 'feedback:view'] };
    expect(hasPermission(admin, 'users', 'view')).toBe(true);
    expect(hasPermission(admin, 'users', 'edit')).toBe(true);
    expect(hasPermission(admin, 'feedback', 'view')).toBe(true);
    expect(hasPermission(admin, 'feedback', 'edit')).toBe(false);
  });

  it('returns false without throwing for a null admin', () => {
    expect(() => hasPermission(null, 'users', 'view')).not.toThrow();
    expect(hasPermission(null, 'users', 'view')).toBe(false);
  });

  it('returns false without throwing for an undefined admin', () => {
    expect(() => hasPermission(undefined, 'users', 'view')).not.toThrow();
    expect(hasPermission(undefined, 'users', 'view')).toBe(false);
  });

  it('returns false without throwing for an admin object with no permissions field', () => {
    expect(() => hasPermission({}, 'users', 'view')).not.toThrow();
    expect(hasPermission({}, 'users', 'view')).toBe(false);
  });

  it('returns false without throwing when permissions is null or an unexpected type', () => {
    expect(() => hasPermission({ permissions: null }, 'users', 'view')).not.toThrow();
    expect(hasPermission({ permissions: null }, 'users', 'view')).toBe(false);

    expect(() => hasPermission({ permissions: 42 }, 'users', 'view')).not.toThrow();
    expect(hasPermission({ permissions: 42 }, 'users', 'view')).toBe(false);

    expect(() => hasPermission({ permissions: {} }, 'users', 'view')).not.toThrow();
    expect(hasPermission({ permissions: {} }, 'users', 'view')).toBe(false);
  });

  it('returns false without throwing when module/action are missing', () => {
    const admin = { permissions: ['users:view'] };
    expect(() => hasPermission(admin, undefined, undefined)).not.toThrow();
    expect(hasPermission(admin, undefined, undefined)).toBe(false);
  });
});
