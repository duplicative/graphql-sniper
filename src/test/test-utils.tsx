import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { FuzzerProvider } from '../FuzzerContext'

interface AllTheProvidersProps {
  children: ReactNode
}

// Provider with BrowserRouter for page components (GraphQLPage, Fuzzer)
export function AllTheProviders({ children }: AllTheProvidersProps) {
  return (
    <FuzzerProvider>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </FuzzerProvider>
  )
}

// Provider without BrowserRouter for App component (which has its own router)
export function AppWrapper({ children }: AllTheProvidersProps) {
  return <FuzzerProvider>{children}</FuzzerProvider>
}

// Use this for testing page components that need router context
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Use this for testing the App component (which provides its own router)
export function renderApp(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AppWrapper, ...options })
}

export function createMockFetchResponse(data: any, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({
      'content-type': 'application/json',
      'content-length': JSON.stringify(data).length.toString(),
    }),
  } as Response)
}

export function createProxySuccessResponse(body: string, status = 200) {
  return {
    status,
    statusText: 'OK',
    headers: {
      'content-type': 'application/json',
    },
    body,
    isError: false,
  }
}

export function createProxyErrorResponse(error: string) {
  return {
    error,
  }
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
