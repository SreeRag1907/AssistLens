// ============================================================================
// HOOK & CONTEXT TESTS: src/lib/theme.tsx
// ============================================================================
//
// CONCEPTS COVERED IN THIS FILE:
//   1.  renderHook()       — render a React hook in isolation (no component)
//   2.  act()              — wrap state-changing operations for React to flush
//   3.  Custom hook testing — asserting hook return values
//   4.  Context testing     — ThemeProvider supplies context to children
//   5.  localStorage assertions — verify side effects
//   6.  document.documentElement — assert DOM class changes
//
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '../../lib/theme';

// ── Wrapper: every renderHook call needs the ThemeProvider ───────────────────
function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

// ============================================================================
// TESTING A REACT HOOK
// ============================================================================
// You can't call hooks outside a React component normally.
// renderHook() gives us a special "test component" that calls our hook
// and exposes its return value via `result.current`.
// ============================================================================
describe('useTheme hook', () => {
  beforeEach(() => {
    // Start each test with a clean localStorage and a clean DOM
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('provides theme and toggle function', () => {
    // renderHook() renders a tiny component that calls useTheme().
    // We wrap it with { wrapper } so useTheme finds the ThemeProvider context.
    const { result } = renderHook(() => useTheme(), { wrapper });

    // result.current holds whatever the hook returned
    // The theme should be either 'light' or 'dark'
    expect(['light', 'dark']).toContain(result.current.theme);

    // toggle should be a function
    expect(typeof result.current.toggle).toBe('function');

    // setTheme should be a function
    expect(typeof result.current.setTheme).toBe('function');
  });

  it('toggles theme from dark to light', () => {
    // Pre-set dark theme in localStorage
    localStorage.setItem('assistlens.theme', 'dark');

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');

    // act() tells React: "I'm about to make something that causes state updates.
    // Please flush all those updates before I continue."
    // Required when directly calling state-changing functions in tests.
    act(() => {
      result.current.toggle();
    });

    // After toggle, theme should be 'light'
    expect(result.current.theme).toBe('light');
  });

  it('toggles theme from light to dark', () => {
    localStorage.setItem('assistlens.theme', 'light');

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe('dark');
  });

  it('setTheme directly sets a specific theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme('light');
    });
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.setTheme('dark');
    });
    expect(result.current.theme).toBe('dark');
  });
});

// ============================================================================
// TESTING SIDE EFFECTS
// ============================================================================
// Our ThemeProvider has two side effects when theme changes:
//   1. Updates document.documentElement's 'dark' class
//   2. Persists theme to localStorage
// ============================================================================
describe('ThemeProvider side effects', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('adds "dark" class to <html> when theme is dark', () => {
    localStorage.setItem('assistlens.theme', 'dark');

    // A tiny test component that reads and displays the theme
    function TestComponent() {
      const { theme } = useTheme();
      return <div data-testid="theme-display">{theme}</div>;
    }

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    // The ThemeProvider useEffect should have added 'dark' class to <html>
    expect(document.documentElement).toHaveClass('dark');
  });

  it('removes "dark" class from <html> when theme is light', () => {
    localStorage.setItem('assistlens.theme', 'light');

    function TestComponent() {
      const { theme } = useTheme();
      return <span>{theme}</span>;
    }

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('persists theme to localStorage on toggle', () => {
    localStorage.setItem('assistlens.theme', 'dark');

    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggle();
    });

    // After toggling, localStorage should be updated to 'light'
    expect(localStorage.getItem('assistlens.theme')).toBe('light');
  });
});

// ============================================================================
// TESTING CONTEXT CONSUMPTION IN COMPONENTS
// ============================================================================
// This verifies that components correctly consume the ThemeProvider context.
// ============================================================================
describe('ThemeProvider in component tree', () => {
  it('provides theme to nested children via context', () => {
    function DeepChild() {
      const { theme } = useTheme();
      return <p data-testid="theme-value">{theme}</p>;
    }

    function Parent() {
      return (
        <div>
          <DeepChild />
        </div>
      );
    }

    localStorage.setItem('assistlens.theme', 'light');

    render(
      <ThemeProvider>
        <Parent />
      </ThemeProvider>,
    );

    // The deeply nested component reads the correct theme from context
    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
  });

  it('all consumers see the updated theme after toggle', async () => {
    // This test demonstrates that when one component calls toggle(),
    // ALL components reading useTheme() re-render with the new value.

    function ChildA() {
      const { theme } = useTheme();
      return <span data-testid="child-a">{theme}</span>;
    }

    function ChildB() {
      const { toggle } = useTheme();
      return <button onClick={toggle}>Toggle</button>;
    }

    localStorage.setItem('assistlens.theme', 'dark');

    render(
      <ThemeProvider>
        <ChildA />
        <ChildB />
      </ThemeProvider>,
    );

    // Initial: dark
    expect(screen.getByTestId('child-a')).toHaveTextContent('dark');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /toggle/i }));

    // After toggle: both components see the new 'light' theme
    expect(screen.getByTestId('child-a')).toHaveTextContent('light');
  });
});
