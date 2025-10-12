import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFuzzerConfig } from './FuzzerContext'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { graphql as cmGraphql } from 'cm6-graphql'
import { json as cmJson } from '@codemirror/lang-json'

interface ReplacementMarker {
  text: string
  from: number
  to: number
}

interface FuzzResult {
  requestNum: number
  statusCode: string
  contentLength: string
  timeMs: number
  requestBody: string
  responseBody: string
  responseHeaders: Record<string, string>
  wordlistItem: string
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

function parseWordlist(wordlistText: string): string[] {
  return wordlistText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function replaceTextInQuery(query: string, marker: ReplacementMarker, replacement: string): string {
  return query.substring(0, marker.from) + replacement + query.substring(marker.to)
}

export default function Fuzzer() {
  const { config } = useFuzzerConfig()
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'config' | 'results'>('config')
  
  // Configuration state
  const [url, setUrl] = useState(config.url)
  const [headersRaw, setHeadersRaw] = useState(config.headersRaw)
  const [rawBody, setRawBody] = useState(config.rawBody)
  const [query, setQuery] = useState(config.query)
  const [variables, setVariables] = useState(config.variables)
  const [useProxy, setUseProxy] = useState(config.useProxy)
  const [proxyUrl, setProxyUrl] = useState(config.proxyUrl)
  
  // Wordlist and replacement state
  const [wordlistText, setWordlistText] = useState('')
  const [replacementMarker, setReplacementMarker] = useState<ReplacementMarker | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null)
  
  // Fuzzing configuration
  const [threads, setThreads] = useState(1)
  const [delayMs, setDelayMs] = useState(0)
  
  // Fuzzing state
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<FuzzResult[]>([])
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [progressCount, setProgressCount] = useState(0)
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestCountRef = useRef(0)
  const editorViewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    setUrl(config.url)
    setHeadersRaw(config.headersRaw)
    setRawBody(config.rawBody)
    setQuery(config.query)
    setVariables(config.variables)
    setUseProxy(config.useProxy)
    setProxyUrl(config.proxyUrl)
  }, [config])

  function handleQuerySelection(view: EditorView) {
    editorViewRef.current = view
    const selection = view.state.selection.main
    const selectedText = view.state.doc.sliceString(selection.from, selection.to)
    
    if (selectedText) {
      setSelectedText(selectedText)
      setSelectionRange({ from: selection.from, to: selection.to })
    } else {
      setSelectedText('')
      setSelectionRange(null)
    }
  }

  function markForReplacement() {
    if (selectionRange && selectedText) {
      setReplacementMarker({
        text: selectedText,
        from: selectionRange.from,
        to: selectionRange.to,
      })
    }
  }

  function clearMarker() {
    setReplacementMarker(null)
    setSelectedText('')
    setSelectionRange(null)
  }

  async function sendSingleRequest(
    requestNum: number,
    wordlistItem: string,
    signal: AbortSignal
  ): Promise<FuzzResult> {
    const startTime = performance.now()
    
    try {
      const headersUser = parseRawHeaders(headersRaw)
      const headers = mergeDefaultJsonContentType(headersUser)

      // Apply replacement if marker exists
      let currentQuery = query
      if (replacementMarker) {
        currentQuery = replaceTextInQuery(query, replacementMarker, wordlistItem)
      }

      // Build request body with replaced query
      const requestBodyObj = {
        query: currentQuery,
        variables: JSON.parse(variables || '{}'),
      }
      const requestBodyStr = JSON.stringify(requestBodyObj)

      let statusCode: string
      let contentLength: string
      let responseBodyStr = ''
      let responseHeadersMap: Record<string, string> = {}

      if (useProxy) {
        const proxyRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url, 
            method: 'POST', 
            headers, 
            body: requestBodyStr 
          }),
          signal,
        })
        
        const summary = await proxyRes.json()
        
        if (summary.error) {
          statusCode = `Proxy Error: ${summary.error}`
          contentLength = '0'
        } else {
          statusCode = summary.status?.toString() || 'Unknown'
          responseBodyStr = summary.body || ''
          responseHeadersMap = summary.headers || {}
          contentLength = responseBodyStr.length.toString()
        }
      } else {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: requestBodyStr,
          signal,
        })
        
        statusCode = response.status.toString()
        responseBodyStr = await response.text()
        contentLength = responseBodyStr.length.toString()
        
        response.headers.forEach((value, key) => {
          responseHeadersMap[key] = value
        })
      }

      const endTime = performance.now()
      const timeMs = Math.round(endTime - startTime)

      return {
        requestNum,
        statusCode,
        contentLength,
        timeMs,
        requestBody: requestBodyStr,
        responseBody: responseBodyStr,
        responseHeaders: responseHeadersMap,
        wordlistItem,
      }
    } catch (err: any) {
      const endTime = performance.now()
      const timeMs = Math.round(endTime - startTime)
      
      if (err.name === 'AbortError') {
        throw err
      }
      
      return {
        requestNum,
        statusCode: `Error: ${err.message || 'Unknown'}`,
        contentLength: '0',
        timeMs,
        requestBody: '',
        responseBody: '',
        responseHeaders: {},
        wordlistItem,
      }
    }
  }

  async function startFuzzing() {
    const wordlist = parseWordlist(wordlistText)
    
    if (wordlist.length === 0) {
      alert('Please provide a wordlist')
      return
    }

    if (!replacementMarker) {
      alert('Please mark text for replacement')
      return
    }

    setIsRunning(true)
    setResults([])
    setProgressCount(0)
    setActiveTab('results')
    requestCountRef.current = 0
    
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      if (threads === 1) {
        // Sequential execution (original behavior)
        for (const word of wordlist) {
          if (controller.signal.aborted) break
          
          requestCountRef.current += 1
          const result = await sendSingleRequest(requestCountRef.current, word, controller.signal)
          
          setResults((prev) => [...prev, result])
          setProgressCount((prev) => prev + 1)
          
          // Apply delay if configured
          if (delayMs > 0 && requestCountRef.current < wordlist.length) {
            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }
        }
      } else {
        // Concurrent execution with controlled parallelism
        const allResults: FuzzResult[] = []
        const resultMap = new Map<number, FuzzResult>()
        let processedCount = 0
        
        // Process wordlist in batches based on thread count
        for (let i = 0; i < wordlist.length; i += threads) {
          if (controller.signal.aborted) break
          
          const batch = wordlist.slice(i, i + threads)
          const batchPromises = batch.map((word, batchIndex) => {
            const requestNum = i + batchIndex + 1
            return sendSingleRequest(requestNum, word, controller.signal)
          })
          
          const batchResults = await Promise.allSettled(batchPromises)
          
          // Process batch results
          batchResults.forEach((promiseResult, batchIndex) => {
            if (promiseResult.status === 'fulfilled') {
              const result = promiseResult.value
              resultMap.set(result.requestNum, result)
              processedCount++
            }
          })
          
          // Update results in order
          const orderedResults: FuzzResult[] = []
          for (let j = 1; j <= processedCount; j++) {
            const result = resultMap.get(j)
            if (result) orderedResults.push(result)
          }
          setResults(orderedResults)
          setProgressCount(processedCount)
          
          // Apply delay between batches if configured
          if (delayMs > 0 && i + threads < wordlist.length) {
            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }
        }
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

  function toggleRowExpansion(requestNum: number) {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(requestNum)) {
        newSet.delete(requestNum)
      } else {
        newSet.add(requestNum)
      }
      return newSet
    })
  }

  const wordlistLines = parseWordlist(wordlistText).length

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4">
      <div className="max-w-[1800px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-100">Fuzzer</h1>
          <Link to="/" className="btn-secondary">
            ← Back to GraphQL
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700">
          <button
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'config'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
            onClick={() => setActiveTab('config')}
          >
            Configuration
          </button>
          <button
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'results'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
            onClick={() => setActiveTab('results')}
          >
            Results ({results.length})
          </button>
        </div>

        {/* Configuration Tab */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            {/* Basic Configuration */}
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
            </div>

            {/* Query Editor with Wordlist - 3 Column Layout */}
            <div className="grid grid-cols-3 gap-4">
              {/* GraphQL Query */}
              <div className="panel">
                <div className="flex items-center justify-between mb-2">
                  <label className="pane-title">GraphQL Query (Select Text to Mark)</label>
                </div>
                <CodeMirror
                  value={query}
                  height="400px"
                  extensions={[
                    cmGraphql(),
                    EditorView.updateListener.of((update) => {
                      if (update.view) {
                        handleQuerySelection(update.view)
                      }
                    }),
                  ]}
                  theme="dark"
                  onChange={(v) => setQuery(v)}
                />
                
                {/* Selection Info and Mark Button */}
                <div className="mt-3 space-y-2">
                  {selectedText && !replacementMarker && (
                    <div className="text-sm">
                      <span className="text-slate-400">Selected:</span>{' '}
                      <span className="text-indigo-400 font-mono">"{selectedText}"</span>
                    </div>
                  )}
                  
                  {replacementMarker && (
                    <div className="bg-indigo-900/30 border border-indigo-700 rounded p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-400">Marked for replacement:</span>{' '}
                          <span className="text-indigo-300 font-mono font-bold">"{replacementMarker.text}"</span>
                        </div>
                        <button
                          className="text-slate-400 hover:text-slate-200 text-xs"
                          onClick={clearMarker}
                        >
                          ✕ Clear
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <button
                    className="btn w-full"
                    onClick={markForReplacement}
                    disabled={!selectedText || !!replacementMarker}
                  >
                    {replacementMarker ? '✓ Text Marked' : 'Mark Selection for Replacement'}
                  </button>
                </div>
              </div>

              {/* Variables */}
              <div className="panel">
                <label className="pane-title">Variables (JSON)</label>
                <CodeMirror
                  value={variables}
                  height="400px"
                  extensions={[cmJson()]}
                  theme="dark"
                  onChange={(v) => setVariables(v)}
                />
              </div>

              {/* Wordlist */}
              <div className="panel">
                <div className="flex items-center justify-between mb-2">
                  <label className="pane-title">Wordlist</label>
                  <span className="text-xs text-slate-400">
                    {wordlistLines} {wordlistLines === 1 ? 'word' : 'words'}
                  </span>
                </div>
                <textarea
                  className="input-base w-full font-mono text-xs h-[400px]"
                  placeholder="Paste wordlist here (one word per line)..."
                  value={wordlistText}
                  onChange={(e) => setWordlistText(e.target.value)}
                />
              </div>
            </div>

            {/* Performance Configuration */}
            <div className="panel space-y-4">
              <h2 className="pane-title text-base">Performance Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="pane-title text-sm">Concurrent Threads</label>
                  <input
                    type="number"
                    className="input-base mt-1 w-full px-3 py-2"
                    placeholder="1"
                    min="1"
                    max="50"
                    value={threads}
                    onChange={(e) => setThreads(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                    disabled={isRunning}
                  />
                  <div className="mt-1 text-xs text-slate-400">
                    Number of parallel requests (1-50). Higher = faster but more aggressive.
                  </div>
                </div>
                
                <div>
                  <label className="pane-title text-sm">Delay Between Requests (ms)</label>
                  <input
                    type="number"
                    className="input-base mt-1 w-full px-3 py-2"
                    placeholder="0"
                    min="0"
                    max="10000"
                    value={delayMs}
                    onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value) || 0))}
                    disabled={isRunning}
                  />
                  <div className="mt-1 text-xs text-slate-400">
                    Delay between requests/batches. Use to avoid rate limiting.
                  </div>
                </div>
              </div>
            </div>

            {/* Fuzzing Controls */}
            <div className="panel">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <button
                    className="btn"
                    onClick={startFuzzing}
                    disabled={isRunning || !url || wordlistLines === 0 || !replacementMarker}
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
                    {isRunning ? (
                      <>
                        Progress: {progressCount} / {wordlistLines} 
                        ({Math.round((progressCount / wordlistLines) * 100)}%)
                      </>
                    ) : (
                      <>
                        Ready to fuzz with {wordlistLines} {wordlistLines === 1 ? 'word' : 'words'}
                        {!replacementMarker && ' (mark text first)'}
                      </>
                    )}
                  </div>
                </div>
                
                {isRunning && (
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progressCount / wordlistLines) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="panel">
            <h2 className="pane-title text-base mb-3">Fuzzing Results</h2>
            
            {results.length === 0 ? (
              <div className="text-slate-400 text-sm py-8 text-center">
                No results yet. Configure the fuzzer and click "Start Fuzzing".
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-800 text-slate-300">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold w-16">#</th>
                      <th className="text-left px-3 py-2 font-semibold">Wordlist Item</th>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                      <th className="text-left px-3 py-2 font-semibold">Length</th>
                      <th className="text-left px-3 py-2 font-semibold">Time (ms)</th>
                      <th className="text-left px-3 py-2 font-semibold w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {results.map((result) => (
                      <>
                        <tr key={result.requestNum} className="hover:bg-slate-800/40">
                          <td className="px-3 py-2 text-slate-300">{result.requestNum}</td>
                          <td className="px-3 py-2 text-indigo-300 font-mono">{result.wordlistItem}</td>
                          <td className="px-3 py-2 text-slate-100">{result.statusCode}</td>
                          <td className="px-3 py-2 text-slate-300">{result.contentLength}</td>
                          <td className="px-3 py-2 text-slate-300">{result.timeMs}</td>
                          <td className="px-3 py-2">
                            <button
                              className="text-xs text-indigo-400 hover:text-indigo-300"
                              onClick={() => toggleRowExpansion(result.requestNum)}
                            >
                              {expandedRows.has(result.requestNum) ? '▼ Collapse' : '▶ Expand'}
                            </button>
                          </td>
                        </tr>
                        {expandedRows.has(result.requestNum) && (
                          <tr key={`${result.requestNum}-details`}>
                            <td colSpan={6} className="px-3 py-3 bg-slate-800/60">
                              <div className="space-y-3">
                                {/* Request Details */}
                                <div>
                                  <div className="text-xs font-semibold text-slate-400 mb-1">
                                    REQUEST BODY:
                                  </div>
                                  <pre className="bg-slate-900 p-2 rounded text-xs overflow-auto max-h-40 text-slate-200">
                                    {result.requestBody || 'N/A'}
                                  </pre>
                                </div>

                                {/* Response Headers */}
                                <div>
                                  <div className="text-xs font-semibold text-slate-400 mb-1">
                                    RESPONSE HEADERS:
                                  </div>
                                  <pre className="bg-slate-900 p-2 rounded text-xs overflow-auto max-h-32 text-slate-200">
                                    {Object.entries(result.responseHeaders)
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join('\n') || 'N/A'}
                                  </pre>
                                </div>

                                {/* Response Body */}
                                <div>
                                  <div className="text-xs font-semibold text-slate-400 mb-1">
                                    RESPONSE BODY:
                                  </div>
                                  <pre className="bg-slate-900 p-2 rounded text-xs overflow-auto max-h-60 text-slate-200">
                                    {result.responseBody || 'N/A'}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
