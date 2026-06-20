// ============================================================================
// PAGE TESTS: src/pages/Login.tsx
// ============================================================================
//
// CONCEPTS COVERED IN THIS FILE:
//   1.  vi.mock()              — module mocking (replace real API with fake)
//   2.  vi.mocked()            — typed access to mock function
//   3.  mockResolvedValueOnce  — fake async success response
//   4.  mockRejectedValueOnce  — fake async failure (throw error)
//   5.  waitFor()              — wait for async DOM updates
//   6.  findBy* queries        — async queries (return a Promise)
//   7.  screen.getByLabelText  — find input by its label
//   8.  userEvent.type()       — simulate typing
//   9.  userEvent.click()      — simulate clicking
//  10.  toBeDisabled()         — button disabled during loading
//  11.  Mock navigation        — assert navigation happened
//
// WHY MOCKING IS CRITICAL:
//   The Login component calls `login()` from our API module, which makes a
//   real HTTP request. In tests we NEVER want real network calls because:
//   - Tests become slow (network latency)
//   - Tests become flaky (server might be down)
//   - Tests might change real data
//   Instead, we replace `login()` with a fake function that returns whatever
//   we need for each test scenario.
//
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../lib/theme';
import { Login } from '../../pages/Login';
import { ApiError } from '../../lib/api';

// ── STEP 1: Mock the entire API module ───────────────────────────────────────
//
// vi.mock('./path') intercepts all imports of that module.
// After this call, `import { login, setAgentToken } from '../../lib/api'`
// in Login.tsx will get FAKE functions, not the real ones.
//
// The factory function `() => ({ ... })` provides the mock implementations.
// Every exported function becomes a `vi.fn()` — a spy that records calls.
//
vi.mock('../../lib/api', () => ({
  login: vi.fn(),         // replaces the real login() HTTP call
  setAgentToken: vi.fn(), // replaces localStorage writes
  ApiError: class ApiError extends Error {
    // We re-create ApiError as a real class so `instanceof ApiError` works
    constructor(message: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

// ── STEP 2: Mock react-router-dom's useNavigate ──────────────────────────────
//
// Login.tsx calls useNavigate() to redirect after success.
// We mock it to get a spy we can assert on.
//
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  // importOriginal() gets the REAL module so we can keep everything else intact
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,                          // keep MemoryRouter, Link, etc. real
    useNavigate: () => mockNavigate,    // only replace useNavigate
  };
});

// ── Import AFTER mocking so we get the spy versions ──────────────────────────
import { login, setAgentToken } from '../../lib/api';

// ── Helper: render Login with all required providers ─────────────────────────
function renderLogin() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <Login />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

// ── Helpers to query common elements ─────────────────────────────────────────
// These avoid repeating the same getBy* calls in every test.
const getEmailInput = () => screen.getByLabelText(/email/i);
const getPasswordInput = () => screen.getByLabelText(/password/i);
const getSubmitButton = () => screen.getByRole('button', { name: /continue/i });

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================
describe('Login page', () => {
  // beforeEach runs before EVERY test in this describe block
  beforeEach(() => {
    // Reset mock call history so tests don't interfere with each other.
    // Without this, call counts from one test bleed into the next.
    vi.clearAllMocks();
  });

  // afterEach runs after EVERY test — good for cleanup
  afterEach(() => {
    localStorage.clear();
  });

  // ==========================================================================
  // RENDERING TESTS — "Does the page show the right elements?"
  // ==========================================================================
  describe('Rendering', () => {
    it('renders the email and password fields', () => {
      renderLogin();
      // getByLabelText() finds the <input> associated with a <label>
      // This is the BEST way to query form fields — mirrors how users use forms.
      expect(getEmailInput()).toBeInTheDocument();
      expect(getPasswordInput()).toBeInTheDocument();
    });

    it('renders the submit button', () => {
      renderLogin();
      expect(getSubmitButton()).toBeInTheDocument();
    });

    it('renders the "Agent sign in" heading', () => {
      renderLogin();
      // getByRole('heading') finds any h1-h6 element
      expect(screen.getByRole('heading', { name: /agent sign in/i })).toBeInTheDocument();
    });

    it('renders the register link', () => {
      renderLogin();
      // getByRole('link') finds <a> elements
      expect(screen.getByRole('link', { name: /create an agent account/i })).toBeInTheDocument();
    });

    it('does not show an error message initially', () => {
      renderLogin();
      // queryByRole() returns null if not found (no throw)
      // Use this when asserting something is NOT present
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // INTERACTION TESTS — "Does typing and clicking work?"
  // ==========================================================================
  describe('Form interactions', () => {
    it('updates email field when user types', async () => {
      renderLogin();
      const user = userEvent.setup();

      // userEvent.type() simulates the full keyboard experience:
      // click to focus → type each character → trigger change events
      await user.type(getEmailInput(), 'agent@test.com');

      // toHaveValue() asserts the current field value
      expect(getEmailInput()).toHaveValue('agent@test.com');
    });

    it('updates password field when user types', async () => {
      renderLogin();
      const user = userEvent.setup();
      await user.type(getPasswordInput(), 'secret123');
      expect(getPasswordInput()).toHaveValue('secret123');
    });

    it('shows "Signing in…" and disables button on submit', async () => {
      // Make the login() call hang forever (never resolves) so we can test
      // the loading state. new Promise(() => {}) is a promise that never settles.
      vi.mocked(login).mockReturnValue(new Promise(() => {}));

      renderLogin();
      const user = userEvent.setup();

      await user.type(getEmailInput(), 'agent@test.com');
      await user.type(getPasswordInput(), 'pass');
      await user.click(getSubmitButton());

      // After submit, the button text should change to loading state
      // and the button should be disabled to prevent double-submits
      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    });
  });

  // ==========================================================================
  // SUCCESS PATH — "Does a successful login navigate to /agent?"
  // ==========================================================================
  describe('Successful login', () => {
    it('calls login() with correct credentials', async () => {
      // mockResolvedValueOnce() makes the spy return a resolved Promise
      // with this value the NEXT time it's called.
      vi.mocked(login).mockResolvedValueOnce({
        token: 'jwt-token-abc',
        agent: { id: '1', email: 'agent@test.com', name: 'Test Agent' },
      } as Awaited<ReturnType<typeof login>>);

      renderLogin();
      const user = userEvent.setup();

      await user.type(getEmailInput(), 'agent@test.com');
      await user.type(getPasswordInput(), 'correctpassword');
      await user.click(getSubmitButton());

      // waitFor() retries the assertion until it passes or times out.
      // We need this because the API call is async — the state updates
      // happen asynchronously, so we wait for them to complete.
      await waitFor(() => {
        // toHaveBeenCalledWith() checks what arguments the spy received
        expect(login).toHaveBeenCalledWith('agent@test.com', 'correctpassword');
      });
    });

    it('stores the token and navigates to /agent on success', async () => {
      vi.mocked(login).mockResolvedValueOnce({
        token: 'jwt-token-abc',
        agent: { id: '1', email: 'agent@test.com', name: 'Test Agent' },
      } as Awaited<ReturnType<typeof login>>);

      renderLogin();
      const user = userEvent.setup();

      await user.type(getEmailInput(), 'agent@test.com');
      await user.type(getPasswordInput(), 'correctpassword');
      await user.click(getSubmitButton());

      await waitFor(() => {
        // setAgentToken() should have been called with the token + email
        expect(setAgentToken).toHaveBeenCalledWith('jwt-token-abc', 'agent@test.com');
        // mockNavigate is our spy for useNavigate().
        // We assert that the app navigated to /agent after success.
        expect(mockNavigate).toHaveBeenCalledWith('/agent');
      });
    });
  });

  // ==========================================================================
  // FAILURE PATH — "Does a failed login show the error message?"
  // ==========================================================================
  describe('Failed login', () => {
    it('shows ApiError message on failed login', async () => {
      // mockRejectedValueOnce() makes the spy throw/reject with this error.
      // This simulates a server returning a 401 Unauthorized response.
      vi.mocked(login).mockRejectedValueOnce(new ApiError('Invalid credentials'));

      renderLogin();
      const user = userEvent.setup();

      await user.type(getEmailInput(), 'wrong@test.com');
      await user.type(getPasswordInput(), 'wrongpassword');
      await user.click(getSubmitButton());

      // findByText() is an ASYNC query — it returns a Promise and waits
      // for the element to appear in the DOM (with a timeout).
      // Use findBy* whenever the element appears asynchronously.
      const errorEl = await screen.findByText(/invalid credentials/i);
      expect(errorEl).toBeInTheDocument();
    });

    it('shows generic error for non-ApiError failures', async () => {
      // A generic Error (not ApiError) should show the fallback message
      vi.mocked(login).mockRejectedValueOnce(new Error('Network error'));

      renderLogin();
      const user = userEvent.setup();

      await user.type(getEmailInput(), 'agent@test.com');
      await user.type(getPasswordInput(), 'pass');
      await user.click(getSubmitButton());

      // Our component shows 'Login failed.' for non-ApiError errors
      const errorEl = await screen.findByText(/login failed/i);
      expect(errorEl).toBeInTheDocument();
    });

    it('does NOT navigate on failed login', async () => {
      vi.mocked(login).mockRejectedValueOnce(new ApiError('Invalid credentials'));

      renderLogin();
      const user = userEvent.setup();

      await user.type(getEmailInput(), 'wrong@test.com');
      await user.type(getPasswordInput(), 'wrong');
      await user.click(getSubmitButton());

      // Wait for the error to appear first (confirms the flow completed)
      await screen.findByText(/invalid credentials/i);

      // Then assert navigate was never called
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('re-enables button after a failed login', async () => {
      vi.mocked(login).mockRejectedValueOnce(new ApiError('Bad credentials'));

      renderLogin();
      const user = userEvent.setup();

      await user.type(getEmailInput(), 'a@b.com');
      await user.type(getPasswordInput(), 'pass');
      await user.click(getSubmitButton());

      // Wait for error to confirm the request completed
      await screen.findByText(/bad credentials/i);

      // The button should now say "Continue" again (not "Signing in…")
      // and be re-enabled so the user can try again
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /continue/i });
        expect(btn).not.toBeDisabled();
      });
    });

    it('clears previous error when submitting again', async () => {
      vi.mocked(login)
        .mockRejectedValueOnce(new ApiError('First error'))
        // Next call hangs (simulates second submit in-progress)
        .mockReturnValueOnce(new Promise(() => {}));

      renderLogin();
      const user = userEvent.setup();

      await user.type(getEmailInput(), 'a@b.com');
      await user.type(getPasswordInput(), 'pass');
      await user.click(getSubmitButton());

      // Wait for first error
      await screen.findByText(/first error/i);

      // Submit again — the component calls setError(null) at the start
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // The error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/first error/i)).not.toBeInTheDocument();
      });
    });
  });
});
