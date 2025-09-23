import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787

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

function forward({ targetUrl, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl)
    const isHttps = u.protocol === 'https:'
    const transport = isHttps ? https : http

    const opts = {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: method || 'POST',
      headers: headers || {},
    }

    const req = transport.request(opts, (res) => {
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
        resolve({
          status: res.statusCode || 0,
          statusText: res.statusMessage || '',
          headers: headersOut,
          body: text,
        })
      })
    })
    req.on('error', reject)
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
    const payload = JSON.parse(raw || '{}')
    const targetUrl = payload.url || payload.targetUrl
    if (!targetUrl) throw new Error('Missing url')
    const method = payload.method || 'POST'
    const headers = payload.headers || {}
    let body = payload.body
    let outBody = undefined
    if (typeof body === 'string') {
      outBody = body
    } else if (body !== undefined) {
      outBody = JSON.stringify(body)
      if (!headers['content-length'] && !headers['Content-Length']) {
        headers['Content-Length'] = Buffer.byteLength(outBody)
      }
      if (!headers['content-type'] && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      }
    }

    const result = await forward({ targetUrl, method, headers, body: outBody })
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (e) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: String(e?.message || e) }))
  }
})

server.listen(PORT, () => {
  console.log(`Proxy listening on http://localhost:${PORT}`)
})
