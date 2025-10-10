import { createContext, useState, useContext, ReactNode } from 'react'

export interface FuzzerConfig {
  url: string
  headersRaw: string
  rawBody: string
  query: string
  variables: string
  useProxy: boolean
  proxyUrl: string
}

interface FuzzerContextType {
  config: FuzzerConfig
  setConfig: (config: FuzzerConfig) => void
}

const FuzzerContext = createContext<FuzzerContextType | undefined>(undefined)

export function FuzzerProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<FuzzerConfig>({
    url: '',
    headersRaw: '',
    rawBody: '',
    query: '',
    variables: '{}',
    useProxy: true,
    proxyUrl: 'http://localhost:8787/forward',
  })

  return (
    <FuzzerContext.Provider value={{ config, setConfig }}>
      {children}
    </FuzzerContext.Provider>
  )
}

export function useFuzzerConfig() {
  const context = useContext(FuzzerContext)
  if (!context) {
    throw new Error('useFuzzerConfig must be used within FuzzerProvider')
  }
  return context
}
