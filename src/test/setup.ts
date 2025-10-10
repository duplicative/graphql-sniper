import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { createElement } from 'react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock CodeMirror globally to avoid jsdom DOM API issues
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: any) =>
    createElement('textarea', {
      'data-testid': 'codemirror-mock',
      value: value || '',
      onChange: (e: any) => onChange?.(e.target.value),
    }),
}))

// Mock fetch globally
global.fetch = vi.fn()

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
})

// Mock performance.now for timing tests
const originalPerformanceNow = performance.now
let mockTime = 0
global.performance.now = vi.fn(() => {
  mockTime += 100 // Each call advances by 100ms for predictable timing
  return mockTime
})

// Reset mock time before each test
afterEach(() => {
  mockTime = 0
})

// Export utilities for tests
export { originalPerformanceNow }
