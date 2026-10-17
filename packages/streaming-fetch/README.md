# @the-polyfills/streaming-fetch

Streaming `fetch` over `XMLHttpRequest` for React Native, with a Server-Sent Events (SSE) reader

React Native's built-in `fetch` waits for the whole response and has no `response.body`. `xhrStreamingFetch` resolves as soon as headers arrive and streams the body as text. `readSse` turns any `fetch` response into a stream of SSE events.

Unlike an `EventSource` polyfill, this works with any method, body and headers, e.g. a `POST` with a JSON body.

## Usage

```ts
import { readSse, xhrStreamingFetch } from '@the-polyfills/streaming-fetch'

const controller = new AbortController()

const response = await xhrStreamingFetch('https://example.com/chat', {
  method: 'POST',
  headers: {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ message: 'Hello' }),
  signal: controller.signal,
})

if (!response.ok) throw new Error(`HTTP ${response.status}`)

for await (const { event, data, id } of readSse(response)) {
  if (event === 'done') break // stops reading and aborts the request

  console.log(event, id, JSON.parse(data))
}
```

### Lower level: `createSseParser`

Feed text yourself, e.g. from a WebSocket or a custom transport:

```ts
import { createSseParser } from '@the-polyfills/streaming-fetch'

const parser = createSseParser((e) => console.log(e.event, e.data), {
  onRetry: (ms) => console.log('server asks to reconnect after', ms),
})

parser.push('event: greet\ndata: hel')
parser.push('lo\n\n') // logs "greet hello"
parser.flush() // at end of stream
```

## Notes

- **Chunks are strings.** Hermes has no `TextDecoder`, so `xhrStreamingFetch` hands out `string` chunks instead of `Uint8Array`. `readSse` accepts both.
- **The server must flush each event and must not compress the response.** Otherwise the body arrives in one piece.
- **`readSse` works with any `fetch`.** With RN's built-in `fetch` it falls back to reading the whole body, so events only arrive at the end.
- **No auto-reconnect.** `retry:` values are reported through `onRetry`, and `id` is available on every event, so you can reconnect with `Last-Event-ID` yourself.
- **`xhrStreamingFetch` implements only part of `Response`:** `ok`, `status`, `statusText`, `headers`, `url`, `body.getReader()`, `text()` and `json()`. The body can be read once.

Please refer to README.md at https://github.com/doanhtu07/react-native-the-polyfills for more details and documentation.
