// ============================================================================
// TEST SETUP FILE
// ============================================================================
// This file runs ONCE before every test file in the project.
// Its job: extend Vitest's `expect` with extra DOM matchers from
// @testing-library/jest-dom so we can write expressive assertions like:
//
//   expect(button).toBeInTheDocument()    ← element exists in the DOM
//   expect(input).toHaveValue('hello')    ← input has a specific value
//   expect(button).toBeDisabled()         ← element has disabled attribute
//   expect(el).toHaveClass('active')      ← element has a CSS class
//   expect(el).toHaveTextContent('Save')  ← element contains text
//   expect(el).toBeVisible()              ← element is visible to user
//
// Without this import, `expect(el).toBeInTheDocument()` would throw
// "toBeInTheDocument is not a function".
// ============================================================================

import '@testing-library/jest-dom';

// ── Browser API Polyfills for jsdom ──────────────────────────────────────────
// jsdom (the fake browser used by Vitest) doesn't implement every browser API.
// We manually stub the ones our components rely on.
//
// WHY THIS IS NEEDED:
//   Our ThemeProvider calls window.matchMedia('(prefers-color-scheme: light)')
//   to detect the system color scheme. jsdom doesn't support this API.
//   We replace it with a fake that always returns { matches: false } (= dark).
//
// This is a very common real-world pattern — you'll see it in almost every
// React project that uses media queries or responsive features.
//
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,              // default to "not matching" = dark mode
    media: query,
    onchange: null,
    addListener: () => {},       // deprecated but some libs still call it
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
