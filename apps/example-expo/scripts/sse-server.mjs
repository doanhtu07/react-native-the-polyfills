// Local SSE server for the fetch-sse screen: `node scripts/sse-server.mjs`
//
// Sends 10 `tick` events 500ms apart, then ends the stream. Each event has an
// `id`, a multi-line `data`, and the first one a `retry`, so the screen can
// check every field the parser handles plus a clean end of stream.

import http from 'node:http'

const PORT = 3001

http
  .createServer((req, res) => {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/event-stream',
    })

    res.write(': connected\nretry: 3000\n\n')

    let n = 0

    const timer = setInterval(() => {
      res.write(`id: ${n}\nevent: tick\ndata: {"n":${n}}\ndata: line 2\n\n`)

      if (++n === 10) {
        clearInterval(timer)
        res.end()
      }
    }, 500)

    req.on('close', () => clearInterval(timer))
  })
  .listen(PORT, () => console.log(`SSE server on http://localhost:${PORT}`))
