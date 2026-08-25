/**
 * Auth boundaries — contract §1 "Auth requirements" and §3.
 *
 * SCOPE NOTE, stated so this suite is not mistaken for more than it is.
 * Two-actor cross-tenant tests (firm B requests firm A's row) need signed-in sessions, and
 * minting those needs SUPABASE_SERVICE_ROLE_KEY, which is not obtainable in this environment.
 * What IS proven here is the unauthenticated boundary on every protected route and page —
 * the layer that must hold before any role question even arises.
 *
 * The cross-tenant assertions are written and skipped, not omitted: a missing test looks
 * identical to a passing one, and that fails toward a false pass.
 */
import { expect, test } from '@playwright/test';

const PROTECTED_API = [
  { method: 'GET',   path: '/api/ledger' },
  { method: 'GET',   path: '/api/ledger/verify' },
  { method: 'GET',   path: '/api/ledger/export' },
  { method: 'GET',   path: '/api/recommendations' },
  { method: 'GET',   path: '/api/custodian/connections' },
  { method: 'POST',  path: '/api/custodian/sync' },
  { method: 'POST',  path: '/api/custodian/import' },
  { method: 'POST',  path: '/api/advisors/invite' },
  { method: 'PATCH', path: '/api/firm/settings' },
] as const;

const PROTECTED_PAGES = ['/', '/households', '/ledger', '/settings'] as const;

test.describe('health', () => {
  test('the deploy probe answers without a session', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty('commit');
    expect(body).toHaveProperty('migrations');
  });
});

test.describe('unauthenticated API access', () => {
  for (const route of PROTECTED_API) {
    test(`${route.method} ${route.path} refuses with 401 and the contract error shape`, async ({ request }) => {
      const response = await request.fetch(route.path, {
        method: route.method,
        data: route.method === 'GET' ? undefined : {},
        failOnStatusCode: false,
      });
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ error: 'unauthorized' });
    });
  }
});

test.describe('unauthenticated page access', () => {
  for (const path of PROTECTED_PAGES) {
    test(`${path} redirects to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in$/);
    });
  }
});

test.describe('sign-in screen', () => {
  test('renders the form', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('offers no way to create an account', async ({ page }) => {
    // Contract §1 "First user": there is no public sign-up, and the UI must not imply one.
    // A sign-up route on a system holding custodial positions is a finding at the first exam.
    await page.goto('/sign-in');
    const body = (await page.textContent('body')) ?? '';
    expect(body).not.toMatch(/sign up|create account|register/i);
    await expect(page.getByText(/invitation from your firm/i)).toBeVisible();
  });

  test('states an invite-only access model', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByText(/Access is by invitation/i)).toBeVisible();
  });
});

test.describe('cross-tenant isolation', () => {
  test.skip(true, 'Needs SUPABASE_SERVICE_ROLE_KEY to mint two signed-in advisors. ' +
                  'Not obtainable in this environment — see build-notes.md.');

  test('firm B requesting firm A household gets 404, never 403', async () => {
    // 404 rather than 403 is deliberate: a 403 confirms the resource exists, which is itself
    // the cross-tenant leak. Contract §3.
  });

  test('a readonly advisor cannot approve a recommendation', async () => {
    // Expect 403 { error: 'readonly_role' }.
  });

  test('a non-principal cannot toggle shadow mode', async () => {
    // Expect 403 { error: 'principal_only' }.
  });
});
