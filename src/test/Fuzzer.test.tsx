import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { waitFor, screen, within } from '@testing-library/react'
import { renderWithProviders, userEvent, createMockFetchResponse, createProxySuccessResponse, createProxyErrorResponse } from './test-utils'
import Fuzzer from '../Fuzzer'

describe('Fuzzer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Render', () => {
    it('should render all main sections', () => {
      renderWithProviders(<Fuzzer />)

      expect(screen.getByText('Fuzzer')).toBeInTheDocument()
      expect(screen.getByText('Request Configuration')).toBeInTheDocument()
      expect(screen.getByText('Results')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /start fuzzing/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /stop fuzzing/i })).toBeInTheDocument()
    })

    it('should have Start Fuzzing button enabled and Stop Fuzzing disabled initially', () => {
      renderWithProviders(<Fuzzer />)

      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      const stopButton = screen.getByRole('button', { name: /stop fuzzing/i })

      expect(stopButton).toBeDisabled()
      // Start button should be disabled if no URL
      expect(startButton).toBeDisabled()
    })

    it('should show empty results message initially', () => {
      renderWithProviders(<Fuzzer />)

      expect(screen.getByText(/no results yet/i)).toBeInTheDocument()
    })

    it('should render Back to GraphQL link', () => {
      renderWithProviders(<Fuzzer />)

      const backLink = screen.getByText(/back to graphql/i)
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/')
    })
  })

  describe('Form Inputs', () => {
    it('should allow entering target URL', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Fuzzer />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      expect(urlInput).toHaveValue('https://api.test.com/graphql')
    })

    it('should allow entering headers', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Fuzzer />)

      const headersTextarea = screen.getByPlaceholderText(/Authorization: Bearer/i)
      await user.type(headersTextarea, 'Authorization: Bearer test-token')

      expect(headersTextarea).toHaveValue('Authorization: Bearer test-token')
    })

    it('should allow entering raw body', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Fuzzer />)

      const bodyTextarea = screen.getByPlaceholderText(/{"query":"query/i)
      await user.click(bodyTextarea)
      await user.paste('{"query":"{ users { id } }"}')

      expect(bodyTextarea).toHaveValue('{"query":"{ users { id } }"}')
    })

    it('should toggle proxy checkbox', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Fuzzer />)

      const proxyCheckbox = screen.getByLabelText(/use local proxy/i)
      expect(proxyCheckbox).toBeChecked()

      await user.click(proxyCheckbox)
      expect(proxyCheckbox).not.toBeChecked()

      await user.click(proxyCheckbox)
      expect(proxyCheckbox).toBeChecked()
    })

    it('should disable proxy URL input when proxy is unchecked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Fuzzer />)

      const proxyCheckbox = screen.getByLabelText(/use local proxy/i)
      const proxyUrlInput = screen.getByDisplayValue('http://localhost:8787/forward')

      expect(proxyUrlInput).not.toBeDisabled()

      await user.click(proxyCheckbox)
      expect(proxyUrlInput).toBeDisabled()
    })
  })

  describe('Fuzzing Loop - Proxy Mode', () => {
    it('should send requests via proxy and display results', async () => {
      const user = userEvent.setup()
      
      // Mock fetch for proxy requests
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValue(
        createMockFetchResponse(
          createProxySuccessResponse('{"data":{"users":[]}}', 200)
        )
      )
      global.fetch = mockFetch

      renderWithProviders(<Fuzzer />)

      // Enter URL
      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      // Enter body
      const bodyTextarea = screen.getByPlaceholderText(/{"query":"query/i)
      await user.click(bodyTextarea)
      await user.paste('{"query":"{ test }"}')

      // Start fuzzing
      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      await user.click(startButton)

      // Wait for first request
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Check that request was sent to proxy
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/forward',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('https://api.test.com/graphql'),
        })
      )

      // Verify results table appears
      await waitFor(() => {
        const table = screen.getByRole('table')
        expect(table).toBeInTheDocument()
      })

      // Check first result row
      const firstRow = screen.getByText('1').closest('tr')
      expect(firstRow).toBeInTheDocument()
      expect(within(firstRow!).getByText('200')).toBeInTheDocument()

      // Stop fuzzing
      const stopButton = screen.getByRole('button', { name: /stop fuzzing/i })
      await user.click(stopButton)

      // Wait for state to update
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start fuzzing/i })).not.toBeDisabled()
      })
    })

    it('should handle multiple requests in loop', async () => {
      const user = userEvent.setup()
      
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValue(
        createMockFetchResponse(
          createProxySuccessResponse('{"data":{}}', 200)
        )
      )
      global.fetch = mockFetch

      renderWithProviders(<Fuzzer />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      const bodyTextarea = screen.getByPlaceholderText(/{"query":"query/i)
      await user.click(bodyTextarea)
      await user.paste('{"query":"{ test }"}')

      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      await user.click(startButton)

      // Wait for multiple requests
      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(3)
      }, { timeout: 3000 })

      // Stop fuzzing
      const stopButton = screen.getByRole('button', { name: /stop fuzzing/i })
      await user.click(stopButton)

      // Verify multiple results are displayed
      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        // At least 3 data rows + 1 header row
        expect(rows.length).toBeGreaterThanOrEqual(4)
      })
    })

    it('should handle proxy errors gracefully', async () => {
      const user = userEvent.setup()
      
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValue(
        createMockFetchResponse(
          createProxyErrorResponse('Connection refused')
        )
      )
      global.fetch = mockFetch

      renderWithProviders(<Fuzzer />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      const bodyTextarea = screen.getByPlaceholderText(/{"query":"query/i)
      await user.click(bodyTextarea)
      await user.paste('{"query":"{ test }"}')

      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText(/Proxy Error: Connection refused/i)).toBeInTheDocument()
      })

      const stopButton = screen.getByRole('button', { name: /stop fuzzing/i })
      await user.click(stopButton)
    })
  })

  describe('Fuzzing Loop - Direct Mode', () => {
    it('should send requests directly when proxy is disabled', async () => {
      const user = userEvent.setup()
      
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValue(
        createMockFetchResponse({ data: { users: [] } }, true, 201)
      )
      global.fetch = mockFetch

      renderWithProviders(<Fuzzer />)

      // Disable proxy
      const proxyCheckbox = screen.getByLabelText(/use local proxy/i)
      await user.click(proxyCheckbox)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      const bodyTextarea = screen.getByPlaceholderText(/{"query":"query/i)
      await user.click(bodyTextarea)
      await user.paste('{"query":"{ test }"}')

      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      await user.click(startButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Verify direct request (not to proxy)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/graphql',
        expect.objectContaining({
          method: 'POST',
          body: '{"query":"{ test }"}',
        })
      )

      // Check status code in results
      await waitFor(() => {
        expect(screen.getByText('201')).toBeInTheDocument()
      })

      const stopButton = screen.getByRole('button', { name: /stop fuzzing/i })
      await user.click(stopButton)
    })
  })

  describe('Button States', () => {
    it('should disable Start and enable Stop when fuzzing starts', async () => {
      const user = userEvent.setup()
      
      const mockFetch = vi.fn()
      mockFetch.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => {
          resolve(createMockFetchResponse(createProxySuccessResponse('{}', 200)))
        }, 100)
      }))
      global.fetch = mockFetch

      renderWithProviders(<Fuzzer />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      const stopButton = screen.getByRole('button', { name: /stop fuzzing/i })

      expect(startButton).not.toBeDisabled()
      expect(stopButton).toBeDisabled()

      await user.click(startButton)

      // After clicking Start, it should be disabled and Stop should be enabled
      await waitFor(() => {
        expect(startButton).toBeDisabled()
        expect(stopButton).not.toBeDisabled()
      })

      await user.click(stopButton)

      // After stopping, Start should be enabled again
      await waitFor(() => {
        expect(startButton).not.toBeDisabled()
        expect(stopButton).toBeDisabled()
      })
    })

    it('should disable Start button when URL is empty', async () => {
      renderWithProviders(<Fuzzer />)

      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      expect(startButton).toBeDisabled()
    })

    it('should show running status text', async () => {
      const user = userEvent.setup()
      
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValue(
        createMockFetchResponse(createProxySuccessResponse('{}', 200))
      )
      global.fetch = mockFetch

      renderWithProviders(<Fuzzer />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      expect(screen.getByText('Ready')).toBeInTheDocument()

      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText(/sending requests/i)).toBeInTheDocument()
      })

      const stopButton = screen.getByRole('button', { name: /stop fuzzing/i })
      await user.click(stopButton)

      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument()
      })
    })
  })

  describe('Results Display', () => {
    it('should display correct column headers', async () => {
      const user = userEvent.setup()
      
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValue(
        createMockFetchResponse(createProxySuccessResponse('{"data":{}}', 200))
      )
      global.fetch = mockFetch

      renderWithProviders(<Fuzzer />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Request #')).toBeInTheDocument()
        expect(screen.getByText('Status Code')).toBeInTheDocument()
        expect(screen.getByText('Content-Length')).toBeInTheDocument()
        expect(screen.getByText('Time (ms)')).toBeInTheDocument()
      })

      const stopButton = screen.getByRole('button', { name: /stop fuzzing/i })
      await user.click(stopButton)
    })

    it('should increment request numbers sequentially', async () => {
      const user = userEvent.setup()
      
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValue(
        createMockFetchResponse(createProxySuccessResponse('{}', 200))
      )
      global.fetch = mockFetch

      renderWithProviders(<Fuzzer />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      await user.click(startButton)

      // Wait for 3 requests
      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(3)
      })

      const stopButton = screen.getByRole('button', { name: /stop fuzzing/i })
      await user.click(stopButton)

      // Verify sequential request numbers
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
      })
    })

    it('should clear results when starting new fuzzing session', async () => {
      const user = userEvent.setup()
      
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValue(
        createMockFetchResponse(createProxySuccessResponse('{}', 200))
      )
      global.fetch = mockFetch

      renderWithProviders(<Fuzzer />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      // First session
      let startButton = screen.getByRole('button', { name: /start fuzzing/i })
      await user.click(startButton)

      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2)
      })

      let stopButton = screen.getByRole('button', { name: /stop fuzzing/i })
      await user.click(stopButton)

      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        expect(rows.length).toBeGreaterThanOrEqual(3) // Header + data rows
      })

      // Second session - should clear results
      startButton = screen.getByRole('button', { name: /start fuzzing/i })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument()
        const rows = screen.getAllByRole('row')
        // Should only have header + 1 new row initially
        expect(rows.length).toBeLessThanOrEqual(3)
      })

      stopButton = screen.getByRole('button', { name: /stop fuzzing/i })
      await user.click(stopButton)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const user = userEvent.setup()
      
      const mockFetch = vi.fn()
      mockFetch.mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch

      renderWithProviders(<Fuzzer />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText(/Error: Network error/i)).toBeInTheDocument()
      })

      const stopButton = screen.getByRole('button', { name: /stop fuzzing/i })
      await user.click(stopButton)
    })

    it('should continue fuzzing after individual request errors', async () => {
      const user = userEvent.setup()
      
      const mockFetch = vi.fn()
      // First request fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Request failed'))
        .mockResolvedValue(createMockFetchResponse(createProxySuccessResponse('{}', 200)))
      global.fetch = mockFetch

      renderWithProviders(<Fuzzer />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      await user.click(startButton)

      // Wait for both requests
      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2)
      })

      // Should show both error and success
      await waitFor(() => {
        expect(screen.getByText(/Error: Request failed/i)).toBeInTheDocument()
        expect(screen.getByText('200')).toBeInTheDocument()
      })

      const stopButton = screen.getByRole('button', { name: /stop fuzzing/i })
      await user.click(stopButton)
    })
  })

  describe('Header Parsing', () => {
    it('should parse headers correctly', async () => {
      const user = userEvent.setup()
      
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValue(
        createMockFetchResponse(createProxySuccessResponse('{}', 200))
      )
      global.fetch = mockFetch

      renderWithProviders(<Fuzzer />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.test.com/graphql')

      const headersTextarea = screen.getByPlaceholderText(/Authorization: Bearer/i)
      await user.type(headersTextarea, 'Authorization: Bearer token123\nX-Custom-Header: value')

      const bodyTextarea = screen.getByPlaceholderText(/{"query":"query/i)
      await user.click(bodyTextarea)
      await user.paste('{"query":"{}"}')

      const startButton = screen.getByRole('button', { name: /start fuzzing/i })
      await user.click(startButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Check that headers were parsed and sent
      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      
      expect(requestBody.headers).toHaveProperty('Authorization', 'Bearer token123')
      expect(requestBody.headers).toHaveProperty('X-Custom-Header', 'value')

      const stopButton = screen.getByRole('button', { name: /stop fuzzing/i })
      await user.click(stopButton)
    })
  })
})
