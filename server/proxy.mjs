import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

const PORT = process.env.PORT ? Number(process.env.PORT) : 8788
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true' || process.env.DEBUG === 'yes'

function debugLog(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args)
  }
}

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const buf = Buffer.concat(chunks)
        const str = buf.toString('utf8')
        resolve(str)
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function forward({ targetUrl, method, headers, body, timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl)
    const isHttps = u.protocol === 'https:'
    const transport = isHttps ? https : http

    console.log(`[PROXY] Forwarding ${method || 'POST'} request to ${targetUrl}`)
    debugLog(`[PROXY] Connection details:`, {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + (u.search || ''),
      timeout: timeout,
      headers: headers,
      bodyLength: body ? body.length : 0
    })
    if (DEBUG && body) {
      debugLog(`[PROXY] Request body:`, body)
    }

    const forwardedHeaders = { ...headers || {} };

    // Preserve empty headers (e.g., X-DataStax-Current-Tenant: )
    Object.keys(forwardedHeaders).forEach(key => {
      if (forwardedHeaders[key] === '') {
        forwardedHeaders[key] = ''; // Ensure empty string for proper forwarding
      }
    });

    const opts = {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: method || 'POST',
      headers: forwardedHeaders,
      timeout: timeout,
      tls: {
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        rejectUnauthorized: false,  // For testing only - bypasses cert validation
        ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA'
      }
    }

    debugLog(`[PROXY] Forwarded headers:`, Object.keys(forwardedHeaders).sort().join(', '));
    debugLog(`[PROXY] Body preview:`, body ? body.substring(0, 100) + '...' : 'No body');

    const req = transport.request(opts, (res) => {
      debugLog(`[PROXY] Response received: ${res.statusCode} ${res.statusMessage}`)
      debugLog(`[PROXY] Response headers:`, res.headers)

      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const buf = Buffer.concat(chunks)
        const text = buf.toString('utf8')
        const headersOut = {}
        for (const [k, v] of Object.entries(res.headers)) {
          if (Array.isArray(v)) headersOut[k] = v.join(', ')
          else if (v !== undefined) headersOut[k] = String(v)
        }

        const status = res.statusCode || 0
        const isError = status < 200 || status >= 300

        if (isError) {
          console.error(`[PROXY] Error response: ${status} ${res.statusMessage || ''} from ${targetUrl}`)
          debugLog(`[PROXY] Error response body:`, text)
        } else {
          console.log(`[PROXY] Success response: ${status} from ${targetUrl}`)
          if (DEBUG) {
            debugLog(`[PROXY] Response body length: ${text.length} bytes`)
          }
        }

        resolve({
          status,
          statusText: res.statusMessage || '',
          headers: headersOut,
          body: text,
          isError,
        })
      })
    })

    req.on('timeout', () => {
      console.error(`[PROXY] Request timeout after ${timeout}ms to ${targetUrl}`)
      debugLog(`[PROXY] Timeout details:`, {
        targetUrl,
        timeout,
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80)
      })
      req.destroy()
      reject(new Error(`Request timeout after ${timeout}ms`))
    })

    req.on('error', (err) => {
      console.error(`[PROXY] Request error to ${targetUrl}:`, err.message, err.code || '')
      debugLog(`[PROXY] Error details:`, {
        code: err.code,
        errno: err.errno,
        syscall: err.syscall,
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        stack: err.stack
      })
      reject(err)
    })

    req.on('connect', () => {
      debugLog(`[PROXY] Connected to ${u.hostname}:${u.port || (isHttps ? 443 : 80)}`)
    })

    req.on('socket', (socket) => {
      debugLog(`[PROXY] Socket assigned, remote address: ${socket.remoteAddress}:${socket.remotePort}`)
    })

    if (body) req.write(body)
    req.end()
  })
}

const server = http.createServer(async (req, res) => {
  sendCors(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method Not Allowed' }))
    return
  }
  if (req.url !== '/forward') {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not Found' }))
    return
  }
  try {
    const raw = await readBody(req)
    debugLog(`[PROXY] Received request body:`, raw)

    const payload = JSON.parse(raw || '{}')
    const targetUrl = payload.url || payload.targetUrl
    if (!targetUrl) throw new Error('Missing url')
    const method = payload.method || 'POST'
    const headers = payload.headers || {}

    debugLog(`[PROXY] Parsed request:`, { targetUrl, method, headers: Object.keys(headers) })

    let body = payload.body
    let outBody = undefined

    if (typeof body === 'string') {
      // Treat as raw body (like curl --data-binary) - no modification
      outBody = body
    } else if (body !== undefined) {
      // JSON object - stringify exactly like curl
      outBody = JSON.stringify(body, null, 0); // No pretty-printing, exact format
    }



    const result = await forward({ targetUrl, method, headers, body: outBody })
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (e) {
    console.error(`[PROXY] Forwarding error:`, e.message)
    debugLog(`[PROXY] Error stack:`, e.stack)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      error: String(e?.message || e),
      isError: true,
      status: 0,
      statusText: 'Proxy Error',
      headers: {},
      body: ''
    }))
  }
})

server.listen(PORT, () => {
  console.log(`Proxy listening on http://localhost:${PORT}`)
  if (DEBUG) {
    console.log(`[DEBUG] Debug logging enabled`)
  } else {
    console.log(`Set DEBUG=1 to enable debug logging`)
  }
})
