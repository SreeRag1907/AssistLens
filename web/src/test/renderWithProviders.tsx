// ============================================================================
// CUSTOM RENDER HELPER
// ============================================================================
// React Testing Library's `render()` mounts a component in a bare DOM node.
// But many of our components depend on React context providers:
//   - <ThemeProvider>  → supplies `useTheme()` hook
//   - <MemoryRouter>   → supplies `useNavigate()`, `<Link>`, etc.
//
// Instead of wrapping every test with these providers manually, we create a
// single helper `renderWithProviders()` that pre-wraps the component.
//
// Usage in tests:
//   renderWithProviders(<Login />)
//   renderWithProviders(<MyComponent />, { route: '/dashboard' })
// ============================================================================

import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../lib/theme';
import type { ReactElement } from 'react';

interface Options extends Omit<RenderOptions, 'wrapper'> {
  // The initial URL path the MemoryRouter will start on.
  // Defaults to '/' which is fine for most tests.
  route?: string;
}

export function renderWithProviders(ui: ReactElement, { route = '/', ...options }: Options = {}) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      // MemoryRouter keeps routing state in memory (no real browser URL bar).
      // Perfect for tests — no browser required.
      <MemoryRouter initialEntries={[route]}>
        {/* ThemeProvider supplies the theme context our components read */}
        <ThemeProvider>{children}</ThemeProvider>
      </MemoryRouter>
    );
  }

  // We spread `options` so callers can still pass `container`, `baseElement`, etc.
  return render(ui, { wrapper: Wrapper, ...options });
}

// Re-export everything from RTL so tests only need ONE import:
//   import { screen, fireEvent, renderWithProviders } from '../test/renderWithProviders'
export * from '@testing-library/react';
