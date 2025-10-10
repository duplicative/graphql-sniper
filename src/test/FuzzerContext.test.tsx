import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { FuzzerProvider, useFuzzerConfig, FuzzerConfig } from '../FuzzerContext'
import { ReactNode } from 'react'

describe('FuzzerContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FuzzerProvider>{children}</FuzzerProvider>
  )

  describe('useFuzzerConfig hook', () => {
    it('should provide initial config values', () => {
      const { result } = renderHook(() => useFuzzerConfig(), { wrapper })

      expect(result.current.config).toEqual({
        url: '',
        headersRaw: '',
        rawBody: '',
        query: '',
        variables: '{}',
        useProxy: true,
        proxyUrl: 'http://localhost:8787/forward',
      })
    })

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error
      console.error = () => {}

      expect(() => {
        renderHook(() => useFuzzerConfig())
      }).toThrow('useFuzzerConfig must be used within FuzzerProvider')

      console.error = originalError
    })

    it('should update config when setConfig is called', () => {
      const { result } = renderHook(() => useFuzzerConfig(), { wrapper })

      const newConfig: FuzzerConfig = {
        url: 'https://api.example.com/graphql',
        headersRaw: 'Authorization: Bearer token123',
        rawBody: '{"query":"{ users { id } }"}',
        query: 'query { users { id } }',
        variables: '{"limit": 10}',
        useProxy: false,
        proxyUrl: 'http://localhost:9000/proxy',
      }

      act(() => {
        result.current.setConfig(newConfig)
      })

      expect(result.current.config).toEqual(newConfig)
    })

    it('should allow partial updates to config', () => {
      const { result } = renderHook(() => useFuzzerConfig(), { wrapper })

      const initialConfig = result.current.config

      act(() => {
        result.current.setConfig({
          ...initialConfig,
          url: 'https://test.com/graphql',
        })
      })

      expect(result.current.config.url).toBe('https://test.com/graphql')
      expect(result.current.config.proxyUrl).toBe('http://localhost:8787/forward')
    })

    it('should maintain config across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useFuzzerConfig(), { wrapper })
      const { result: result2 } = renderHook(() => useFuzzerConfig(), { wrapper })

      const newUrl = 'https://shared-config.com/graphql'

      act(() => {
        result1.current.setConfig({
          ...result1.current.config,
          url: newUrl,
        })
      })

      // Both hooks should see the same updated config
      expect(result1.current.config.url).toBe(newUrl)
      expect(result2.current.config.url).toBe(newUrl)
    })
  })

  describe('FuzzerProvider', () => {
    it('should render children correctly', () => {
      const { result } = renderHook(() => useFuzzerConfig(), { wrapper })

      expect(result.current).toBeDefined()
      expect(result.current.config).toBeDefined()
      expect(result.current.setConfig).toBeDefined()
    })

    it('should isolate state between different provider instances', () => {
      const wrapper1 = ({ children }: { children: ReactNode }) => (
        <FuzzerProvider>{children}</FuzzerProvider>
      )
      const wrapper2 = ({ children }: { children: ReactNode }) => (
        <FuzzerProvider>{children}</FuzzerProvider>
      )

      const { result: result1 } = renderHook(() => useFuzzerConfig(), {
        wrapper: wrapper1,
      })
      const { result: result2 } = renderHook(() => useFuzzerConfig(), {
        wrapper: wrapper2,
      })

      act(() => {
        result1.current.setConfig({
          ...result1.current.config,
          url: 'https://provider1.com',
        })
      })

      expect(result1.current.config.url).toBe('https://provider1.com')
      expect(result2.current.config.url).toBe('') // Should remain unchanged
    })
  })
})
