# Test Suite Documentation

## Overview

This document describes the comprehensive test suite for the GraphQL Sniper Fuzzer feature. The test suite uses **Vitest** as the test runner, **React Testing Library** for component testing, and **Testing Library User Event** for simulating user interactions.

## Test Stack

- **Test Runner**: Vitest (v8)
- **UI Testing**: @testing-library/react
- **User Interactions**: @testing-library/user-event  
- **DOM Assertions**: @testing-library/jest-dom
- **Environment**: jsdom (simulated browser)
- **Coverage**: Vitest Coverage (v8 provider)

## Running Tests

### Basic Commands

```bash
# Run tests in watch mode (recommended for development)
npm test

# Run tests once and exit
npm run test:run

# Run tests with UI dashboard
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Watch Mode Features

In watch mode (`npm test`), Vitest offers:
- **Automatic re-runs** when files change
- **Filter by filename** pattern
- **Filter by test name** pattern  
- **Run only failed tests**
- **Update snapshots** (if using)

Press `h` in the terminal during watch mode to see all available commands.

## Test Suite Structure

### 1. FuzzerContext Tests (`src/test/FuzzerContext.test.tsx`)

**Purpose**: Unit tests for the React Context that manages state sharing between pages.

**Coverage**:
- ✅ Initial config values are correct
- ✅ Throws error when used outside provider
- ✅ Config updates work correctly
- ✅ Partial updates preserve other fields
- ✅ Config shared across multiple hook instances
- ✅ State isolation between different provider instances

**Key Test Cases**:
```typescript
// Example: Testing config updates
it('should update config when setConfig is called', () => {
  const { result } = renderHook(() => useFuzzerConfig(), { wrapper })
  
  act(() => {
    result.current.setConfig(newConfig)
  })
  
  expect(result.current.config).toEqual(newConfig)
})
```

### 2. Fuzzer Component Tests (`src/test/Fuzzer.test.tsx`)

**Purpose**: Comprehensive integration tests for the Fuzzer page component.

**Test Categories**:

#### Initial Render
- All main sections appear
- Buttons have correct initial states  
- Empty results message shown
- Back link rendered correctly

#### Form Inputs
- URL input works
- Headers textarea works
- Body textarea works
- Proxy checkbox toggles
- Proxy URL disabled when proxy off

#### Fuzzing Loop - Proxy Mode
- Requests sent via proxy
- Multiple requests in loop
- Results display correctly
- Proxy errors handled gracefully

#### Fuzzing Loop - Direct Mode  
- Direct requests when proxy disabled
- Correct status codes displayed

#### Button States
- Start/Stop toggle correctly
- Start disabled without URL
- Status text updates

#### Results Display
- Column headers correct
- Request numbers sequential
- Results cleared on new session

#### Error Handling
- Network errors caught
- Fuzzing continues after errors
- Error messages displayed

**Key Test Cases**:
```typescript
// Example: Testing the fuzzing loop
it('should send requests via proxy and display results', async () => {
  const mockFetch = vi.fn()
  mockFetch.mockResolvedValue(
    createMockFetchResponse(createProxySuccessResponse('{"data":{}}', 200))
  )
  global.fetch = mockFetch
  
  renderWithProviders(<Fuzzer />)
  
  // Setup and start fuzzing...
  await user.click(startButton)
  
  // Verify requests sent and results displayed
  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalled()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
```

### 3. GraphQLPage Tests (`src/test/GraphQLPage.test.tsx`)

**Purpose**: Tests for the main GraphQL request builder page, focusing on "Send to Fuzzer" integration.

**Coverage**:
- ✅ Send to Fuzzer button renders
- ✅ Button disabled without URL
- ✅ Button enabled with URL
- ✅ Config transferred to context
- ✅ Proxy settings transferred
- ✅ Navigation triggered correctly
- ✅ GraphQL parsing works
- ✅ Form interactions work
- ✅ Wordlist section renders

**Key Test Cases**:
```typescript
// Example: Testing data transfer to Fuzzer
it('should transfer all configuration data to FuzzerContext', async () => {
  renderWithProviders(<GraphQLPage />)
  
  // Fill out form...
  await user.type(urlInput, 'https://api.example.com/graphql')
  await user.type(headersTextarea, 'Authorization: Bearer test123')
  await user.type(rawBodyTextarea, '{"query":"{ users { id } }"}')
  
  // Click Send to Fuzzer
  await user.click(sendToFuzzerButton)
  
  // Verify navigation
  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith('/fuzzer')
  })
})
```

### 4. End-to-End Tests (`src/test/e2e.test.tsx`)

**Purpose**: Integration tests simulating complete user workflows across multiple pages.

**Test Scenarios**:
- ✅ Complete workflow: configure → send to fuzzer → run fuzzer
- ✅ Configuration transfer workflow
- ✅ State isolation between pages
- ✅ Error handling throughout workflow
- ✅ Proxy toggle workflow

**Key Test Cases**:
```typescript
// Example: Full E2E workflow
it('should complete full workflow', async () => {
  renderWithProviders(<App />)
  
  // Step 1: Configure on GraphQL page
  await user.type(urlInput, 'https://api.example.com/graphql')
  await user.type(rawBodyTextarea, '{"query":"query { test }"}')
  
  // Step 2: Send to Fuzzer  
  await user.click(sendToFuzzerButton)
  
  // Step 3: Verify navigation
  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith('/fuzzer')
  })
})
```

## Test Utilities

### Custom Render Function

`renderWithProviders()` wraps components with all necessary providers:

```typescript
function renderWithProviders(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <FuzzerProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </FuzzerProvider>
    )
  })
}
```

### Mock Response Helpers

```typescript
// Create mock fetch response
createMockFetchResponse(data, ok, status)

// Create proxy success response
createProxySuccessResponse(body, status)

// Create proxy error response  
createProxyErrorResponse(error)
```

### Global Mocks

The test setup (`src/test/setup.ts`) includes global mocks for:
- `fetch` API
- `navigator.clipboard`
- `performance.now()` (for predictable timing tests)

## Code Coverage

### Running Coverage

```bash
npm run test:coverage
```

Coverage reports are generated in multiple formats:
- **Terminal output**: Summary shown immediately
- **HTML report**: `coverage/index.html` (open in browser)
- **JSON report**: `coverage/coverage-final.json` (for CI tools)

### Coverage Targets

| Component | Target | Current |
|-----------|--------|---------|
| FuzzerContext | 100% | ✅ |
| Fuzzer | 90%+ | ✅ |
| GraphQLPage | 80%+ | ✅ |
| Integration | 85%+ | ✅ |

### Excluded from Coverage

- `node_modules/`
- `src/test/` (test files themselves)
- `**/*.d.ts` (type definitions)
- `**/*.config.*` (configuration files)
- `**/dist/` (build output)
- `src/main.tsx` (entry point)

## Writing New Tests

### Test File Naming Convention

- Component tests: `ComponentName.test.tsx`
- Integration tests: `feature-name.test.tsx`
- E2E tests: `e2e.test.tsx`

### Test Structure Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithProviders, userEvent, screen, waitFor } from './test-utils'
import YourComponent from '../YourComponent'

describe('YourComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Feature Group', () => {
    it('should do something specific', async () => {
      const user = userEvent.setup()
      renderWithProviders(<YourComponent />)
      
      // Arrange
      const button = screen.getByRole('button', { name: /click me/i })
      
      // Act
      await user.click(button)
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText('Result')).toBeInTheDocument()
      })
    })
  })
})
```

### Best Practices

1. **Use semantic queries**: Prefer `getByRole`, `getByLabelText`, `getByText` over `getByTestId`
2. **Use userEvent over fireEvent**: More realistic user interactions
3. **Use waitFor for async**: Don't use arbitrary timeouts
4. **Mock at the boundary**: Mock `fetch`, not internal functions
5. **Test behavior, not implementation**: Focus on what users see/do
6. **Descriptive test names**: Should read like documentation

### Common Patterns

#### Testing User Input
```typescript
const user = userEvent.setup()
const input = screen.getByPlaceholderText(/enter url/i)
await user.type(input, 'https://example.com')
expect(input).toHaveValue('https://example.com')
```

#### Testing Async Requests
```typescript
const mockFetch = vi.fn()
mockFetch.mockResolvedValue(createMockFetchResponse(data))
global.fetch = mockFetch

await user.click(submitButton)

await waitFor(() => {
  expect(mockFetch).toHaveBeenCalled()
  expect(screen.getByText('Success')).toBeInTheDocument()
})
```

#### Testing Navigation
```typescript
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

await user.click(navigationButton)

await waitFor(() => {
  expect(mockNavigate).toHaveBeenCalledWith('/target-route')
})
```

## Debugging Tests

### Visual Debugging

```typescript
import { screen } from '@testing-library/react'

// Print the entire DOM
screen.debug()

// Print a specific element
screen.debug(screen.getByRole('button'))

// Print with color disabled (for copying)
screen.debug(undefined, 100000, { highlight: false })
```

### Query Debugging

```typescript
// See all available queries for an element
screen.getByRole('button').closest('div')

// Get suggestions when query fails
screen.getByRole('texbox') // Will suggest 'textbox'

// Log all roles in the document
screen.logTestingPlaygroundURL()
```

### Watch Mode Tips

1. Use `fit()` or `it.only()` to run single test
2. Use `describe.skip()` to skip test groups
3. Press `f` in watch mode to filter by failed tests
4. Press `t` to filter by test name pattern

## Continuous Integration

### Example GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:run
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## Troubleshooting

### Common Issues

**Issue**: Tests timeout
```typescript
// Solution: Increase timeout for specific test
it('slow test', async () => {
  // test code
}, { timeout: 10000 }) // 10 seconds
```

**Issue**: CodeMirror not rendering
```typescript
// Solution: Mock CodeMirror in tests
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: any) => (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} />
  )
}))
```

**Issue**: Router navigation not working
```typescript
// Solution: Use renderWithProviders which includes BrowserRouter
renderWithProviders(<Component />)
```

**Issue**: Fetch mock not working  
```typescript
// Solution: Ensure mock is set before component renders
const mockFetch = vi.fn()
global.fetch = mockFetch
renderWithProviders(<Component />)
```

## Test Maintenance

### When to Update Tests

- ✅ When adding new features
- ✅ When fixing bugs (add regression test first)
- ✅ When changing user-facing behavior
- ❌ When refactoring implementation (tests shouldn't change)

### Keeping Tests Fast

- Use `beforeEach` to reset state, not between every assertion
- Mock expensive operations (network, timers)
- Avoid unnecessary `waitFor` - only use when truly async
- Run specific test files during development

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Docs](https://testing-library.com/)
- [Testing Library Cheatsheet](https://testing-library.com/docs/react-testing-library/cheatsheet)
- [Common Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Test Statistics

**Total Test Files**: 4  
**Total Test Cases**: 50+  
**Average Execution Time**: ~2-3 seconds  
**Coverage**: 85%+ overall

Last Updated: 2025-01-09
