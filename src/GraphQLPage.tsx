import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { graphql as cmGraphql } from 'cm6-graphql'
import { json as cmJson } from '@codemirror/lang-json'
import { parse, print, visit } from 'graphql'
import { useFuzzerConfig } from './FuzzerContext'

type HeaderMap = Record<string, string>

function parseRawHeaders(raw: string): HeaderMap {
  const headers: HeaderMap = {}
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Ignore request line like: POST /path HTTP/1.1
    if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/i.test(trimmed)) continue
    const idx = trimmed.indexOf(':')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!key) continue
    // Skip Content-Length header as it will be calculated by the proxy
    if (key.toLowerCase() === 'content-length') continue
    headers[key] = value
  }
  return headers
}

function mergeDefaultJsonContentType(headers: HeaderMap): HeaderMap {
  // Default Content-Type unless user overrides (case-insensitive)
  const ctKey = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type')
  if (!ctKey) {
    return { 'Content-Type': 'application/json', ...headers }
  }
  return headers
}

function safeJsonParse<T = unknown>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined
  }
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

function beautifyGraphQL(query: string): string {
  try {
    const ast = parse(query)
    return print(ast)
  } catch {
    return query
  }
}

function splitWordsTokenize(token: string): string[] {
  if (!token) return []
  const parts: string[] = []
  // First split by non-alphanumeric
  for (const piece of token.split(/[^A-Za-z0-9]+/)) {
    if (!piece) continue
    // Insert spaces at camelCase boundaries
    const spaced = piece.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    for (const sub of spaced.split(/[\s_\-]+/)) {
      if (!sub) continue
      parts.push(sub.toLowerCase())
    }
  }
  return parts
}

function addWord(set: Set<string>, w: string) {
  if (!w) return
  set.add(w.toLowerCase())
  for (const p of splitWordsTokenize(w)) set.add(p)
}

function extractWordsFromGraphQL(query: string, set: Set<string>) {
  try {
    const ast = parse(query)
    visit(ast, {
      OperationDefinition(node) {
        if (node.name?.value) addWord(set, node.name.value)
      },
      Field(node) {
        if (node.name?.value) addWord(set, node.name.value)
      },
      Argument(node) {
        if (node.name?.value) addWord(set, node.name.value)
      },
      FragmentDefinition(node) {
        if (node.name?.value) addWord(set, node.name.value)
      },
      FragmentSpread(node) {
        if (node.name?.value) addWord(set, node.name.value)
      },
      NamedType(node) {
        if (node.name?.value) addWord(set, node.name.value)
      },
    })
  } catch {
    // ignore parse errors
  }
}

function extractWordsFromJson(value: unknown, set: Set<string>) {
  if (value === null || value === undefined) return
  if (typeof value === 'string') {
    addWord(set, value)
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) extractWordsFromJson(v, set)
    return
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      addWord(set, k)
      extractWordsFromJson(v, set)
    }
  }
}

export default function GraphQLPage() {
  const navigate = useNavigate()
  const { setConfig } = useFuzzerConfig()
  
  const [url, setUrl] = useState('')
  const [headersRaw, setHeadersRaw] = useState('')
  const [useProxy, setUseProxy] = useState(true)
  const [proxyUrl, setProxyUrl] = useState('http://localhost:8787/forward')

  const [rawBody, setRawBody] = useState('')
  const [query, setQuery] = useState('')
  const [variables, setVariables] = useState('{}')

  const [sending, setSending] = useState(false)
  const [respStatus, setRespStatus] = useState<string>('')
  const [respHeaders, setRespHeaders] = useState<Array<[string, string]>>([])
  const [respBody, setRespBody] = useState<string>('')

  const [wordSet, setWordSet] = useState<Set<string>>(new Set())
  const [showCurlModal, setShowCurlModal] = useState(false)
  const [curlCommand, setCurlCommand] = useState('')

  function onPasteRaw(text: string) {
    setRawBody(text)
    const json = safeJsonParse<{ query?: string; variables?: unknown }>(text)
    if (json?.query) {
      const pretty = beautifyGraphQL(json.query)
      setQuery(pretty)
      const nextSet = new Set(wordSet)
      extractWordsFromGraphQL(pretty, nextSet)
      if (json.variables !== undefined) {
        setVariables(formatJson(json.variables))
        extractWordsFromJson(json.variables, nextSet)
      }
      setWordSet(nextSet)
    }
  }

  async function onSend() {
    setSending(true)
    setRespStatus('')
    setRespHeaders([])
    setRespBody('')
    try {
      const headersUser = parseRawHeaders(headersRaw)
      const headers = mergeDefaultJsonContentType(headersUser)

      const body: any = { query }
      const vars = safeJsonParse(variables)
      if (vars !== undefined) body.variables = vars
      else body.variables = {}

      let asJson: any = undefined
      if (useProxy) {
        const proxyRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, method: 'POST', headers, body }),
        })
        const summary = await proxyRes.json()

        // Check if proxy itself returned an error
        if (summary.error) {
          setRespStatus(`Proxy Error: ${summary.error}`)
          setRespHeaders([])
          setRespBody('')
          return
        }

        // Handle target server errors
        const statusText = summary.isError ? `Error: ${summary.status} ${summary.statusText || ''}`.trim() : `${summary.status} ${summary.statusText || ''}`.trim()
        setRespStatus(statusText)

        const hdrs = Object.entries(summary.headers || {}) as Array<[string, string]>
        setRespHeaders(hdrs)
        let bodyOut: string = summary.body || ''
        asJson = safeJsonParse(bodyOut)
        if (asJson !== undefined) bodyOut = JSON.stringify(asJson, null, 2)
        setRespBody(bodyOut)
      } else {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })
        setRespStatus(`${res.status} ${res.statusText}`)
        const hdrs: Array<[string, string]> = []
        res.headers.forEach((v, k) => hdrs.push([k, v]))
        setRespHeaders(hdrs)
        const text = await res.text()
        let bodyOut = text
        asJson = safeJsonParse(text)
        if (asJson !== undefined) {
          bodyOut = JSON.stringify(asJson, null, 2)
        }
        setRespBody(bodyOut)
      }

      // Build wordlist from request and response
      const next = new Set(wordSet)
      extractWordsFromGraphQL(query, next)
      extractWordsFromJson(body.variables, next)
      if (asJson !== undefined) extractWordsFromJson(asJson, next)
      setWordSet(next)
    } catch (err: any) {
      setRespStatus('Request failed')
      setRespBody(String(err?.message || err))
    } finally {
      setSending(false)
    }
  }

  function onBeautify() {
    // If rawBody has content, try to parse it. If it contains JSON with a `query`,
    // reuse the onPasteRaw logic. Otherwise, treat the rawBody as a GraphQL query
    // and beautify it directly. If rawBody is empty, just beautify existing editors.
    const body = rawBody.trim()
    if (body) {
      const json = safeJsonParse<{ query?: string; variables?: unknown }>(body)
      if (json?.query) {
        onPasteRaw(body)
      } else {
        // Treat the raw body as a GraphQL query string
        setQuery(beautifyGraphQL(body))
      }
      return
    }

    // Otherwise just beautify the existing query and variables
    setQuery((q) => beautifyGraphQL(q))
    setVariables((v) => {
      const parsed = safeJsonParse(v)
      return parsed !== undefined ? JSON.stringify(parsed, null, 2) : v
    })
  }

  function onCopyWordlist() {
    const text = Array.from(wordSet).sort().join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }

  function onExportWordlist() {
    const text = Array.from(wordSet).sort().join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wordlist.txt'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function onImportWordlist(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const words = text.split(/\r?\n/).map((w) => w.trim()).filter(Boolean)
      const next = new Set(wordSet)
      for (const w of words) addWord(next, w)
      setWordSet(next)
    }
    reader.readAsText(file)
  }

  function onClearWordlist() {
    setWordSet(new Set())
  }

  function onParseCurl() {
    const command = curlCommand.trim();
    if (!command.startsWith('curl ')) {
      console.error("Invalid cURL command");
      setShowCurlModal(false);
      return;
    }

    // Extract URL
    const urlMatch = command.match(/'(https?:\/\/[^']+)'/);
    if (urlMatch) {
      setUrl(urlMatch[1]);
    }

    // Extract Headers
    const headerMatches = command.matchAll(/-H '([^']+)'/g);
    const headers: string[] = [];
    for (const match of headerMatches) {
      headers.push(match[1]);
    }
    setHeadersRaw(headers.join('\n'));

    // Extract Data
    const dataMatch = command.match(/--data-raw \$'([^']+)'/);
    if (dataMatch) {
      const rawData = dataMatch[1].replace(/\\n/g, '\n');
      onPasteRaw(rawData);
    }

    setShowCurlModal(false);
    setCurlCommand('');
  }

  function onSendToFuzzer() {
    setConfig({
      url,
      headersRaw,
      rawBody,
      query,
      variables,
      useProxy,
      proxyUrl,
    })
    navigate('/fuzzer')
  }

  const wordlistText = useMemo(() => Array.from(wordSet).sort().join('\n'), [wordSet])

  return (
    <div className="grid-panels">
      {/* Top Pane: URL + Headers + Controls */}
      <div className="top-pane panel">
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="pane-title">Target URL</label>
              <input
                className="input-base mt-1 w-full px-3 py-2"
                placeholder="https://target.tld/graphql"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <button className="btn" onClick={onSend} disabled={!url || sending}>
              {sending ? 'Sending…' : 'Send'}
            </button>
            <button className="btn-secondary" onClick={onBeautify}>Beautify</button>
            <button className="btn-secondary" onClick={() => setShowCurlModal(true)}>Parse from cURL</button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="pane-title">Global HTTP Headers (raw)</label>
              <textarea
                className="header-textarea mt-1 w-full"
                placeholder={
                  'POST /api/v2/graphql HTTP/1.1\nHost: example.com\nAuthorization: Bearer …\nContent-Type: application/json'
                }
                value={headersRaw}
                onChange={(e) => setHeadersRaw(e.target.value)}
              />
            </div>
            <div>
              <label className="pane-title">Proxy</label>
              <div className="mt-1 flex items-center gap-2">
                <input id="useProxy" type="checkbox" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} />
                <label htmlFor="useProxy" className="text-sm text-slate-300">Use local proxy</label>
              </div>
              <input
                className="input-base mt-2 w-full px-3 py-2 text-xs"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                disabled={!useProxy}
              />
              <div className="mt-1 text-xs text-slate-400">Default: http://localhost:8787/forward</div>
            </div>
            
          </div>
        </div>
      </div>

      {/* Left Pane: Raw JSON body input */}
      <div className="left-pane panel">
        <div className="pane-title">Raw GraphQL JSON request body</div>
        <textarea
          className="input-base mt-2 h-[400px] w-full font-mono text-xs"
          placeholder='{"operationName":"getUsers","variables":{"orgId":"..."},"query":"query …"}'
          value={rawBody}
          onChange={(e) => onPasteRaw(e.target.value)}
        />
        <button 
          className="btn mt-3 w-full" 
          onClick={onSendToFuzzer}
          disabled={!url}
        >
          Send to Fuzzer →
        </button>
      </div>

      {/* Middle Pane: Beautified Query + Variables (editable) */}
      <div className="middle-pane panel">
        <div className="pane-title">GraphQL Query (editable)</div>
        <div className="mt-2">
          <CodeMirror
            value={query}
            height="400px"
            extensions={[cmGraphql()]}
            theme="dark"
            onChange={(v) => setQuery(v)}
          />
        </div>
        <div className="pane-title mt-3">Variables (editable JSON)</div>
        <div className="mt-2">
          <CodeMirror
            value={variables}
            height="220px"
            className="small"
            extensions={[cmJson()]}
            theme="dark"
            onChange={(v) => setVariables(v)}
          />
        </div>
      </div>

      {/* Right Pane: Response */}
      <div className="right-pane panel">
        <div className="pane-title">HTTP Response</div>
        <div className="mt-2 space-y-2 text-sm">
          <div>
            <span className="text-slate-400">Status:</span> {respStatus || '—'}
          </div>
          <div>
            <div className="text-slate-400">Headers:</div>
            <pre className="input-base mt-1 max-h-[160px] overflow-auto p-2 text-xs break-all">{
              respHeaders.map(([k, v]) => `${k}: ${v}`).join('\n') || '—'
            }</pre>
          </div>
          <div>
            <div className="text-slate-400">Body:</div>
            <pre className="input-base mt-1 max-h-[400px] overflow-auto p-2 text-xs break-all">{respBody || '—'}</pre>
          </div>
        </div>
      </div>

      {/* Bottom Pane: Wordlist */}
      <div className="bottom-pane panel">
        <div className="flex items-center justify-between">
          <div className="pane-title">Session Wordlist</div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={onCopyWordlist}>Copy</button>
            <button className="btn-secondary" onClick={onExportWordlist}>Export</button>
            <label className="btn-secondary cursor-pointer">
              Import
              <input
                type="file"
                accept=".txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onImportWordlist(f)
                  e.currentTarget.value = ''
                }}
              />
            </label>
            <button className="btn-secondary" onClick={onClearWordlist}>Clear</button>
          </div>
        </div>
        <textarea
          readOnly
          className="input-base mt-2 h-40 w-full font-mono text-xs"
          value={wordlistText}
        />
      </div>

      {showCurlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-slate-800 p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white">Parse cURL Request</h2>
            <textarea
              className="input-base mt-4 h-64 w-full font-mono text-xs"
              placeholder="Paste cURL command here..."
              value={curlCommand}
              onChange={(e) => setCurlCommand(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowCurlModal(false)}>
                Cancel
              </button>
              <button className="btn" onClick={onParseCurl}>
                Parse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
