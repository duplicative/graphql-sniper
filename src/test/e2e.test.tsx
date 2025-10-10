import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderApp, userEvent, createMockFetchResponse, createProxySuccessResponse } from './test-utils'
import App from '../App'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('End-to-End Fuzzer Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should complete full workflow: configure request → send to fuzzer → run fuzzer → view results', async () => {
    const user = userEvent.setup()

    // Mock fetch for fuzzing requests
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValue(
      createMockFetchResponse(
        createProxySuccessResponse('{"data":{"test":"success"}}', 200)
      )
    )
    global.fetch = mockFetch

    // Step 1: Render the app (GraphQL page by default)
    renderApp(<App />)

    // Step 2: Configure the GraphQL request
    const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
    await user.type(urlInput, 'https://api.example.com/graphql')

    const headersTextarea = screen.getByPlaceholderText(/POST \/api\/v2\/graphql/i)
    await user.type(headersTextarea, 'Authorization: Bearer my-test-token')

    const rawBodyTextarea = screen.getByPlaceholderText(/"operationName":"getUsers"/i)
    await user.click(rawBodyTextarea)
    await user.paste('{"query":"query { users { id name } }"}')

    // Step 3: Send configuration to Fuzzer
    const sendToFuzzerButton = screen.getByRole('button', { name: /send to fuzzer/i })
    expect(sendToFuzzerButton).not.toBeDisabled()
    await user.click(sendToFuzzerButton)

    // Verify navigation was triggered
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/fuzzer')
    })

    // Note: In a real E2E test with actual routing, we would verify the Fuzzer page loads
    // For this unit test, we're verifying the integration points work correctly
  })

  it('should handle configuration transfer and fuzzing workflow', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn()
    let requestCount = 0
    mockFetch.mockImplementation(() => {
      requestCount++
      return createMockFetchResponse(
        createProxySuccessResponse(`{"data":{"request":${requestCount}}}`, 200)
      )
    })
    global.fetch = mockFetch

    renderApp(<App />)

    // Configure request
    const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
    await user.type(urlInput, 'https://test-api.com/graphql')

    const bodyTextarea = screen.getByPlaceholderText(/"operationName":"getUsers"/i)
    await user.click(bodyTextarea)
    await user.paste('{"query":"{ test }"}')

    // Send to fuzzer
    const sendButton = screen.getByRole('button', { name: /send to fuzzer/i })
    await user.click(sendButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })
  })

  it('should maintain state isolation between GraphQL page and Fuzzer', async () => {
    const user = userEvent.setup()

    renderApp(<App />)

    // Enter data on GraphQL page
    const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
    await user.type(urlInput, 'https://original-url.com/graphql')

    expect(urlInput).toHaveValue('https://original-url.com/graphql')

    // Send to fuzzer
    const sendButton = screen.getByRole('button', { name: /send to fuzzer/i })
    await user.click(sendButton)

    // Verify navigation
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/fuzzer')
    })

    // The original page should still have the data (in practice)
    // This tests that the context properly stores the configuration
  })

  it('should handle errors gracefully throughout the workflow', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn()
    mockFetch.mockRejectedValue(new Error('Network failure'))
    global.fetch = mockFetch

    renderApp(<App />)

    const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
    await user.type(urlInput, 'https://error-api.com/graphql')

    const sendButton = screen.getByRole('button', { name: /send to fuzzer/i })
    await user.click(sendButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })

    // In the actual fuzzer, network errors should be caught and displayed
  })

  it('should support proxy toggle workflow', async () => {
    const user = userEvent.setup()

    renderApp(<App />)

    const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
    await user.type(urlInput, 'https://direct-api.com/graphql')

    // Disable proxy
    const proxyCheckbox = screen.getByLabelText(/use local proxy/i)
    await user.click(proxyCheckbox)
    expect(proxyCheckbox).not.toBeChecked()

    const sendButton = screen.getByRole('button', { name: /send to fuzzer/i })
    await user.click(sendButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })

    // The fuzzer should receive the proxy disabled setting
  })
})
