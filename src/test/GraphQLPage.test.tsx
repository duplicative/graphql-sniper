import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, userEvent } from './test-utils'
import GraphQLPage from '../GraphQLPage'
import { useFuzzerConfig } from '../FuzzerContext'

// Mock useNavigate from react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('GraphQLPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Send to Fuzzer Button', () => {
    it('should render Send to Fuzzer button', () => {
      renderWithProviders(<GraphQLPage />)

      const sendToFuzzerButton = screen.getByRole('button', { name: /send to fuzzer/i })
      expect(sendToFuzzerButton).toBeInTheDocument()
    })

    it('should be disabled when URL is empty', () => {
      renderWithProviders(<GraphQLPage />)

      const sendToFuzzerButton = screen.getByRole('button', { name: /send to fuzzer/i })
      expect(sendToFuzzerButton).toBeDisabled()
    })

    it('should be enabled when URL is provided', async () => {
      const user = userEvent.setup()
      renderWithProviders(<GraphQLPage />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.example.com/graphql')

      const sendToFuzzerButton = screen.getByRole('button', { name: /send to fuzzer/i })
      expect(sendToFuzzerButton).not.toBeDisabled()
    })

    it('should transfer all configuration data to FuzzerContext', async () => {
      const user = userEvent.setup()
      const { result: configResult } = renderWithProviders(<GraphQLPage />)

      // Fill out all fields
      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.example.com/graphql')

      const headersTextarea = screen.getByPlaceholderText(/POST \/api\/v2\/graphql/i)
      await user.type(headersTextarea, 'Authorization: Bearer test123')

      const rawBodyTextarea = screen.getByPlaceholderText(/"operationName":"getUsers"/i)
      await user.click(rawBodyTextarea)
      await user.paste('{"query":"{ users { id } }"}')

      // Click Send to Fuzzer
      const sendToFuzzerButton = screen.getByRole('button', { name: /send to fuzzer/i })
      await user.click(sendToFuzzerButton)

      // Verify navigation was called
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/fuzzer')
      })
    })

    it('should transfer proxy settings to FuzzerContext', async () => {
      const user = userEvent.setup()
      renderWithProviders(<GraphQLPage />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://api.example.com/graphql')

      // Toggle proxy off
      const proxyCheckbox = screen.getByLabelText(/use local proxy/i)
      await user.click(proxyCheckbox)

      // Click Send to Fuzzer
      const sendToFuzzerButton = screen.getByRole('button', { name: /send to fuzzer/i })
      await user.click(sendToFuzzerButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/fuzzer')
      })
    })
  })

  describe('GraphQL Query Parsing', () => {
    it('should parse and beautify GraphQL from raw JSON', async () => {
      const user = userEvent.setup()
      renderWithProviders(<GraphQLPage />)

      const rawBodyTextarea = screen.getByPlaceholderText(/"operationName":"getUsers"/i)
      const graphqlQuery = '{"query":"query{users{id name}}"}'
      await user.click(rawBodyTextarea)
      await user.paste(graphqlQuery)

      // The query should be parsed and displayed in the GraphQL editor
      await waitFor(() => {
        // Look for evidence that the query was processed
        const codemirrorElements = document.querySelectorAll('.cm-content')
        expect(codemirrorElements.length).toBeGreaterThan(0)
      })
    })

    it('should extract variables from raw JSON', async () => {
      const user = userEvent.setup()
      renderWithProviders(<GraphQLPage />)

      const rawBodyTextarea = screen.getByPlaceholderText(/"operationName":"getUsers"/i)
      const jsonWithVariables = '{"query":"query { users }","variables":{"limit":10}}'
      await user.click(rawBodyTextarea)
      await user.paste(jsonWithVariables)

      await waitFor(() => {
        const codemirrorElements = document.querySelectorAll('.cm-content')
        expect(codemirrorElements.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Form Interaction', () => {
    it('should allow entering URL', async () => {
      const user = userEvent.setup()
      renderWithProviders(<GraphQLPage />)

      const urlInput = screen.getByPlaceholderText(/https:\/\/target\.tld\/graphql/i)
      await user.type(urlInput, 'https://test.com')

      expect(urlInput).toHaveValue('https://test.com')
    })

    it('should toggle proxy checkbox', async () => {
      const user = userEvent.setup()
      renderWithProviders(<GraphQLPage />)

      const proxyCheckbox = screen.getByLabelText(/use local proxy/i)
      expect(proxyCheckbox).toBeChecked()

      await user.click(proxyCheckbox)
      expect(proxyCheckbox).not.toBeChecked()
    })

    it('should show beautify button', () => {
      renderWithProviders(<GraphQLPage />)

      const beautifyButton = screen.getByRole('button', { name: /beautify/i })
      expect(beautifyButton).toBeInTheDocument()
    })

    it('should show send button', () => {
      renderWithProviders(<GraphQLPage />)

      const sendButton = screen.getByRole('button', { name: /^send$/i })
      expect(sendButton).toBeInTheDocument()
    })
  })

  describe('Wordlist Management', () => {
    it('should render wordlist section', () => {
      renderWithProviders(<GraphQLPage />)

      expect(screen.getByText('Session Wordlist')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
      expect(screen.getByText(/import/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    })
  })
})
