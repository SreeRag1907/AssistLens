// ============================================================================
// COMPONENT TESTS: src/components/ui.tsx
// ============================================================================
//
// CONCEPTS COVERED IN THIS FILE:
//   1.  describe()         — groups related tests together
//   2.  it() / test()      — a single test case
//   3.  render()           — mounts a React component into a fake DOM
//   4.  screen             — queries the rendered DOM
//   5.  Queries            — getBy*, queryBy*, findBy*, getAllBy*, etc.
//   6.  Matchers           — toBeInTheDocument(), toHaveClass(), etc.
//   7.  userEvent          — simulates real user interactions
//   8.  fireEvent          — low-level DOM event dispatching
//   9.  vi.fn()            — creates mock / spy functions
//  10.  beforeEach()       — setup code that runs before each test
//  11.  expect().not       — negation of a matcher
//  12.  snapshot testing   — captures component HTML output
//
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../lib/theme';
import {
  Button,
  Field,
  Card,
  StatusBadge,
  Spinner,
  EmptyState,
  ThemeToggle,
  Logo,
  btnClass,
} from '../../components/ui';

// ── Helper: wrap components that need providers ───────────────────────────────
// Some components call useTheme() internally. They crash without <ThemeProvider>.
// We wrap them here so the test doesn't need to care about providers.
function withProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
}

// ============================================================================
// 1. BUTTON COMPONENT
// ============================================================================
// KEY CONCEPTS:
//   - screen.getByRole()  → most recommended query. Uses ARIA roles to find
//     elements exactly how a screen reader or user would see them.
//   - toBeInTheDocument() → confirms element is mounted in the DOM
//   - toHaveClass()       → checks CSS classes on the element
//   - toBeDisabled()      → checks disabled attribute
//   - vi.fn()             → a "spy" — records how many times it was called
//   - toHaveBeenCalledTimes() → asserts the spy call count
// ============================================================================
describe('Button', () => {
  it('renders children text', () => {
    // render() mounts the component into a virtual (jsdom) DOM.
    // It returns a set of queries, but we prefer using `screen` because
    // screen always queries the full document, not just the returned fragment.
    render(<Button>Click me</Button>);

    // screen.getByRole('button') finds a <button> element.
    // 'name' option checks the accessible name (text content or aria-label).
    // If NOT found, getBy* throws immediately — no false positives.
    const btn = screen.getByRole('button', { name: /click me/i });

    // toBeInTheDocument() from @testing-library/jest-dom
    // Confirms the element is actually in the DOM tree.
    expect(btn).toBeInTheDocument();
  });

  it('applies primary styles by default', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button', { name: /save/i });
    // toHaveClass() checks if the element has these CSS classes.
    // bg-brand is the primary button color defined in our buttonStyles map.
    expect(btn).toHaveClass('bg-brand');
  });

  it('applies secondary styles when variant="secondary"', () => {
    render(<Button variant="secondary">Cancel</Button>);
    const btn = screen.getByRole('button', { name: /cancel/i });
    expect(btn).toHaveClass('border', 'border-line');
    // toNot — the primary class should NOT be present
    expect(btn).not.toHaveClass('bg-brand');
  });

  it('applies danger styles when variant="danger"', () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole('button', { name: /delete/i });
    expect(btn).toHaveClass('bg-red-600');
  });

  it('is disabled when disabled prop is passed', () => {
    render(<Button disabled>Submit</Button>);
    const btn = screen.getByRole('button', { name: /submit/i });
    // toBeDisabled() checks the disabled HTML attribute
    expect(btn).toBeDisabled();
  });

  it('calls onClick handler when clicked', async () => {
    // vi.fn() creates a mock function (a "spy").
    // It records: how many times it was called, with what arguments, etc.
    const handleClick = vi.fn();

    // We pass the spy as the onClick prop
    render(<Button onClick={handleClick}>Go</Button>);

    // userEvent.setup() creates a user-event instance.
    // Always use this pattern instead of the bare userEvent.click() —
    // it correctly simulates pointer events, focus, and keyboard events.
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /go/i }));

    // The spy was called exactly once
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onClick when disabled', async () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    const user = userEvent.setup();
    // Clicking a disabled button should do nothing
    await user.click(screen.getByRole('button', { name: /disabled/i }));
    // toHaveBeenCalledTimes(0) — the handler was never called
    expect(handleClick).toHaveBeenCalledTimes(0);
  });

  it('merges extra className with base styles', () => {
    render(<Button className="w-full mt-4">Wide</Button>);
    const btn = screen.getByRole('button', { name: /wide/i });
    // Both the default and the custom classes should be present
    expect(btn).toHaveClass('bg-brand', 'w-full', 'mt-4');
  });
});

// ============================================================================
// 2. btnClass UTILITY FUNCTION
// ============================================================================
// KEY CONCEPTS:
//   - Testing pure functions (no React, no DOM needed)
//   - toContain() — checks if a string contains a substring
// ============================================================================
describe('btnClass utility', () => {
  it('returns primary classes by default', () => {
    const result = btnClass();
    // btnClass() is a plain JS function — we test it directly, no rendering.
    expect(result).toContain('bg-brand');
    expect(result).toContain('text-brand-fg');
  });

  it('returns danger classes for danger variant', () => {
    const result = btnClass('danger');
    expect(result).toContain('bg-red-600');
  });

  it('appends extra string to result', () => {
    const result = btnClass('primary', 'custom-class another-class');
    expect(result).toContain('custom-class');
    expect(result).toContain('another-class');
  });
});

// ============================================================================
// 3. FIELD (INPUT) COMPONENT
// ============================================================================
// KEY CONCEPTS:
//   - screen.getByRole('textbox')   → finds <input type="text|email">
//   - screen.getByLabelText()       → finds input by its <label> text
//   - toHaveValue()                 → checks current value of input
//   - fireEvent.change()            → dispatches a synthetic change event
//   - userEvent.type()              → simulates real keyboard typing
// ============================================================================
describe('Field (input)', () => {
  it('renders an input element', () => {
    render(<Field type="text" />);
    // getByRole('textbox') finds any <input> whose type is text-like
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('reflects the value prop', () => {
    render(<Field type="email" value="user@test.com" readOnly />);
    // toHaveValue() checks the current value of a form field
    expect(screen.getByRole('textbox')).toHaveValue('user@test.com');
  });

  it('calls onChange when user types', async () => {
    const handleChange = vi.fn();
    render(<Field type="text" onChange={handleChange} />);
    const user = userEvent.setup();

    // userEvent.type() simulates pressing each key one by one.
    // This triggers focus → keydown → keypress → input → keyup for each char.
    // Much closer to how a real user types than fireEvent.change().
    await user.type(screen.getByRole('textbox'), 'hello');

    // onChange was called once per character → 5 times for 'hello'
    expect(handleChange).toHaveBeenCalledTimes(5);
  });

  it('can be found by its associated label', () => {
    // When you render a <label htmlFor="x"> alongside <input id="x">,
    // screen.getByLabelText('Email') finds the input — just like a screen reader.
    render(
      <div>
        <label htmlFor="email">Email</label>
        <Field id="email" type="email" />
      </div>,
    );
    const input = screen.getByLabelText(/email/i);
    expect(input).toBeInTheDocument();
  });

  it('applies muted styles when muted prop is true', () => {
    render(<Field muted type="text" data-testid="muted-input" />);
    // getByTestId() finds elements by data-testid attribute.
    // Use this as a last resort when no semantic query fits.
    const input = screen.getByTestId('muted-input');
    expect(input).toHaveClass('field-muted');
  });
});

// ============================================================================
// 4. CARD COMPONENT
// ============================================================================
// KEY CONCEPTS:
//   - screen.getByText()     → finds element by its text content
//   - toHaveClass()          → checks structural CSS classes
// ============================================================================
describe('Card', () => {
  it('renders children inside the card', () => {
    render(<Card>Card content here</Card>);
    // getByText() finds elements by visible text content.
    // The /regex/i pattern makes it case-insensitive.
    expect(screen.getByText(/card content here/i)).toBeInTheDocument();
  });

  it('applies default card styles', () => {
    render(<Card>Content</Card>);
    // Card only accepts className+children, so we find it via its text content
    // then walk up to the wrapping div with .closest()
    const card = screen.getByText(/content/i).closest('div');
    expect(card).toHaveClass('rounded-xl', 'border', 'border-line', 'bg-surface');
  });

  it('merges extra className', () => {
    render(<Card className="p-8">Content</Card>);
    // Our Card component merges the className prop with the base classes
    expect(screen.getByText(/content/i).closest('div')).toHaveClass('p-8');
  });
});

// ============================================================================
// 5. SPINNER COMPONENT
// ============================================================================
// KEY CONCEPTS:
//   - screen.getByRole('status')  → finds elements with role="status"
//   - toHaveAttribute()           → checks an HTML attribute and its value
//   - aria-label                  → accessible name for icon-only elements
// ============================================================================
describe('Spinner', () => {
  it('renders with role="status" for accessibility', () => {
    render(<Spinner />);
    // Our Spinner has role="status" — screen readers announce this as a loading indicator.
    // getByRole('status') finds it semantically.
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has an accessible label', () => {
    render(<Spinner />);
    // toHaveAttribute(attr, value) checks an HTML attribute
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });

  it('applies default size class', () => {
    render(<Spinner />);
    // Default className is 'h-8 w-8'
    expect(screen.getByRole('status')).toHaveClass('h-8', 'w-8');
  });

  it('applies custom size class', () => {
    render(<Spinner className="h-4 w-4" />);
    expect(screen.getByRole('status')).toHaveClass('h-4', 'w-4');
    expect(screen.getByRole('status')).not.toHaveClass('h-8');
  });
});

// ============================================================================
// 6. STATUSBADGE COMPONENT
// ============================================================================
// KEY CONCEPTS:
//   - toHaveTextContent()  → checks text inside an element (partial match ok)
//   - Multiple test cases efficiently via an array loop
// ============================================================================
describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('renders a live pulse dot for "active" status', () => {
    const { container } = render(<StatusBadge status="active" />);
    // container is the root DOM node returned by render().
    // querySelector() finds the first matching element (standard DOM API).
    // We check for the animated pulse dot that only appears for live statuses.
    const pulseDot = container.querySelector('.animate-pulse');
    expect(pulseDot).toBeInTheDocument();
  });

  it('does NOT render pulse dot for non-live statuses', () => {
    const { container } = render(<StatusBadge status="ended" />);
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('replaces underscores with spaces in status text', () => {
    render(<StatusBadge status="in_progress" />);
    // Our component does status.replace('_', ' ')
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });

  // Testing multiple values efficiently using a data-driven approach
  it.each([
    ['active', 'text-brand'],
    ['ended', 'text-muted'],
    ['failed', 'text-red-600'],
    ['ready', 'text-emerald-600'],
  ])('applies correct color class for status "%s"', (status, expectedClass) => {
    // it.each() runs the same test with different inputs.
    // Much cleaner than copy-pasting the same test 4 times.
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(new RegExp(status.replace('_', ' '), 'i'));
    expect(badge.closest('span')).toHaveClass(expectedClass);
  });
});

// ============================================================================
// 7. EMPTYSTATE COMPONENT
// ============================================================================
describe('EmptyState', () => {
  it('renders its children', () => {
    render(<EmptyState>No sessions found</EmptyState>);
    expect(screen.getByText(/no sessions found/i)).toBeInTheDocument();
  });

  it('renders complex children', () => {
    render(
      <EmptyState>
        <p>No data</p>
        <button>Refresh</button>
      </EmptyState>,
    );
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});

// ============================================================================
// 8. LOGO COMPONENT
// ============================================================================
// KEY CONCEPTS:
//   - Testing conditional rendering based on props
//   - queryByText() vs getByText() — queryBy returns null, getBy throws
// ============================================================================
describe('Logo', () => {
  it('renders without wordmark by default', () => {
    withProviders(<Logo />);
    // queryByText() returns null if not found (no error thrown).
    // Use this when you want to assert something is NOT there.
    // getByText() would throw an error — use queryByText for "not present" checks.
    expect(screen.queryByText(/AssistLens/i)).not.toBeInTheDocument();
  });

  it('renders wordmark when withWordmark=true', () => {
    withProviders(<Logo withWordmark />);
    // Now the wordmark text should appear
    expect(screen.getByText(/Assist/i)).toBeInTheDocument();
  });

  it('uses custom size', () => {
    const { container } = withProviders(<Logo size={48} />);
    // We check inline styles for custom dimensions
    const logoBox = container.querySelector('[style]') as HTMLElement;
    expect(logoBox?.style.width).toBe('48px');
    expect(logoBox?.style.height).toBe('48px');
  });
});

// ============================================================================
// 9. THEMETOGGLE COMPONENT
// ============================================================================
// KEY CONCEPTS:
//   - Testing components that use React Context
//   - beforeEach()        → runs before EVERY test in this describe block
//   - localStorage mock   → Vitest auto-mocks browser APIs in jsdom
//   - toHaveAttribute()   → checks aria-label changes
// ============================================================================
describe('ThemeToggle', () => {
  // beforeEach() runs setup before every single test in this describe block.
  // Here we clear localStorage so each test starts with a clean slate.
  // Without this, theme state from one test would bleed into the next.
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders a toggle button', () => {
    withProviders(<ThemeToggle />);
    // Our ThemeToggle renders a <button> — getByRole('button') finds it
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has an accessible aria-label', () => {
    withProviders(<ThemeToggle />);
    const btn = screen.getByRole('button');
    // The label should describe what will happen when clicked
    // (not what the current state is)
    expect(btn).toHaveAttribute('aria-label');
    const label = btn.getAttribute('aria-label');
    expect(label).toMatch(/switch to (light|dark) mode/i);
  });

  it('toggles aria-label when clicked', async () => {
    withProviders(<ThemeToggle />);
    const user = userEvent.setup();
    const btn = screen.getByRole('button');
    const initialLabel = btn.getAttribute('aria-label');

    await user.click(btn);

    // After clicking, the label should change to reflect the new theme
    expect(btn.getAttribute('aria-label')).not.toBe(initialLabel);
  });
});

// ============================================================================
// 10. SNAPSHOT TESTING
// ============================================================================
// KEY CONCEPTS:
//   - Snapshot tests capture the rendered HTML output on the first run,
//     save it to a .snap file, and compare on subsequent runs.
//   - Great for detecting accidental UI changes.
//   - If you intentionally changed the UI, run: npx vitest --update
//   - toMatchSnapshot() — auto-generates and compares snapshots
//   - asFragment() — returns the rendered DOM as a DocumentFragment
// ============================================================================
describe('Snapshot tests', () => {
  it('Button matches snapshot', () => {
    const { asFragment } = render(<Button variant="primary">Save changes</Button>);
    // asFragment() returns the rendered HTML as a DocumentFragment.
    // The first time this runs, it creates a __snapshots__/ui.test.tsx.snap file.
    // On future runs, it compares the output against the saved snapshot.
    // If output changes unexpectedly, the test FAILS — alerting you to the diff.
    expect(asFragment()).toMatchSnapshot();
  });

  it('StatusBadge "active" matches snapshot', () => {
    const { asFragment } = render(<StatusBadge status="active" />);
    expect(asFragment()).toMatchSnapshot();
  });

  it('Spinner matches snapshot', () => {
    const { asFragment } = render(<Spinner />);
    expect(asFragment()).toMatchSnapshot();
  });
});
