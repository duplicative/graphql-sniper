import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFuzzerConfig } from './FuzzerContext'
import CodeMirror from '@uiw/react-codemirror'
import { graphql as cmGraphql } from 'cm6-graphql'
import { json as cmJson } from '@codemirror/lang-json'

interface FuzzResult {
  requestNum: number
  statusCode: string
  contentLength: string
  timeMs: number
}

type HeaderMap = Record<string, string>

function parseRawHeaders(raw: string): HeaderMap {
  const headers: HeaderMap = {}
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/i.test(trimmed)) continue
    const idx = trimmed.indexOf(':')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!key) continue
    if (key.toLowerCase() === 'content-length') continue
    headers[key] = value
  }
  return headers
}

function mergeDefaultJsonContentType(headers: HeaderMap): HeaderMap {
  const ctKey = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type')
  if (!ctKey) {
    return { 'Content-Type': 'application/json', ...headers }
  }
  return headers
}

export default function Fuzzer() {
  const { config } = useFuzzerConfig()
  
  const [url, setUrl] = useState(config.url)
  const [headersRaw, setHeadersRaw] = useState(config.headersRaw)
  const [rawBody, setRawBody] = useState(config.rawBody)
  const [query, setQuery] = useState(config.query)
  const [variables, setVariables] = useState(config.variables)
  const [useProxy, setUseProxy] = useState(config.useProxy)
  const [proxyUrl, setProxyUrl] = useState(config.proxyUrl)
  
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<FuzzResult[]>([])
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestCountRef = useRef(0)

  useEffect(() => {
    // Update local state when config changes (on page load from navigation)
    setUrl(config.url)
    setHeadersRaw(config.headersRaw)
    setRawBody(config.rawBody)
    setQuery(config.query)
    setVariables(config.variables)
    setUseProxy(config.useProxy)
    setProxyUrl(config.proxyUrl)
  }, [config])

  async function sendSingleRequest(requestNum: number, signal: AbortSignal): Promise<FuzzResult> {
    const startTime = performance.now()
    
    try {
      const headersUser = parseRawHeaders(headersRaw)
      const headers = mergeDefaultJsonContentType(headersUser)

      let response: Response
      let statusCode: string
      let contentLength: string

      if (useProxy) {
        const proxyRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url, 
            method: 'POST', 
            headers, 
            body: rawBody 
          }),
          signal,
        })
        
        const summary = await proxyRes.json()
        
        if (summary.error) {
          statusCode = `Proxy Error: ${summary.error}`
          contentLength = '0'
        } else {
          statusCode = summary.status?.toString() || 'Unknown'
          const bodyLength = summary.body ? summary.body.length : 0
          contentLength = bodyLength.toString()
        }
      } else {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: rawBody,
          signal,
        })
        
        statusCode = response.status.toString()
        const clHeader = response.headers.get('content-length')
        
        if (clHeader) {
          contentLength = clHeader
        } else {
          const text = await response.text()
          contentLength = text.length.toString()
        }
      }

      const endTime = performance.now()
      const timeMs = Math.round(endTime - startTime)

      return {
        requestNum,
        statusCode,
        contentLength,
        timeMs,
      }
    } catch (err: any) {
      const endTime = performance.now()
      const timeMs = Math.round(endTime - startTime)
      
      if (err.name === 'AbortError') {
        throw err // Re-throw abort errors to stop the loop
      }
      
      return {
        requestNum,
        statusCode: `Error: ${err.message || 'Unknown'}`,
        contentLength: '0',
        timeMs,
      }
    }
  }

  async function startFuzzing() {
    setIsRunning(true)
    setResults([])
    requestCountRef.current = 0
    
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      while (!controller.signal.aborted) {
        requestCountRef.current += 1
        const result = await sendSingleRequest(requestCountRef.current, controller.signal)
        
        setResults((prev) => [...prev, result])
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Fuzzing error:', err)
      }
    } finally {
      setIsRunning(false)
      abortControllerRef.current = null
    }
  }

  function stopFuzzing() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsRunning(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-100">Fuzzer</h1>
          <Link to="/" className="btn-secondary">
            ← Back to GraphQL
          </Link>
        </div>

        {/* Configuration Panel */}
        <div className="panel space-y-4">
          <h2 className="pane-title text-base">Request Configuration</h2>
          
          <div>
            <label className="pane-title">Target URL</label>
            <input
              className="input-base mt-1 w-full px-3 py-2"
              placeholder="https://target.tld/graphql"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="pane-title">Global HTTP Headers (raw)</label>
              <textarea
                className="header-textarea mt-1 w-full"
                placeholder="Authorization: Bearer ...&#10;Content-Type: application/json"
                value={headersRaw}
                onChange={(e) => setHeadersRaw(e.target.value)}
              />
            </div>

            <div>
              <label className="pane-title">Proxy Configuration</label>
              <div className="mt-1 flex items-center gap-2">
                <input 
                  id="fuzzerUseProxy" 
                  type="checkbox" 
                  checked={useProxy} 
                  onChange={(e) => setUseProxy(e.target.checked)} 
                />
                <label htmlFor="fuzzerUseProxy" className="text-sm text-slate-300">
                  Use local proxy
                </label>
              </div>
              <input
                className="input-base mt-2 w-full px-3 py-2 text-xs"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                disabled={!useProxy}
              />
            </div>
          </div>

          <div>
            <label className="pane-title">Raw GraphQL JSON request body</label>
            <textarea
              className="input-base mt-1 w-full font-mono text-xs h-32"
              placeholder='{"query":"query {...}","variables":{...}}'
              value={rawBody}
              onChange={(e) => setRawBody(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="pane-title">GraphQL Query (for reference)</label>
              <div className="mt-1">
                <CodeMirror
                  value={query}
                  height="200px"
                  extensions={[cmGraphql()]}
                  theme="dark"
                  onChange={(v) => setQuery(v)}
                />
              </div>
            </div>

            <div>
              <label className="pane-title">Variables (for reference)</label>
              <div className="mt-1">
                <CodeMirror
                  value={variables}
                  height="200px"
                  extensions={[cmJson()]}
                  theme="dark"
                  onChange={(v) => setVariables(v)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="panel">
          <div className="flex items-center gap-3">
            <button
              className="btn"
              onClick={startFuzzing}
              disabled={isRunning || !url}
            >
              {isRunning ? 'Running...' : 'Start Fuzzing'}
            </button>
            <button
              className="btn-secondary"
              onClick={stopFuzzing}
              disabled={!isRunning}
            >
              Stop Fuzzing
            </button>
            <div className="text-sm text-slate-400">
              {isRunning ? `Sending requests... (${results.length} completed)` : `Ready`}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="panel">
          <h2 className="pane-title text-base mb-3">Results</h2>
          
          {results.length === 0 ? (
            <div className="text-slate-400 text-sm py-8 text-center">
              No results yet. Click "Start Fuzzing" to begin.
            </div>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800 text-slate-300">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Request #</th>
                    <th className="text-left px-3 py-2 font-semibold">Status Code</th>
                    <th className="text-left px-3 py-2 font-semibold">Content-Length</th>
                    <th className="text-left px-3 py-2 font-semibold">Time (ms)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {results.map((result) => (
                    <tr key={result.requestNum} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2 text-slate-300">{result.requestNum}</td>
                      <td className="px-3 py-2 text-slate-100">{result.statusCode}</td>
                      <td className="px-3 py-2 text-slate-300">{result.contentLength}</td>
                      <td className="px-3 py-2 text-slate-300">{result.timeMs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
