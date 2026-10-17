import {
  createSseParser,
  type SseEvent,
  type SseParserOptions,
} from './create-sse-parser'

type Utf8Decoder = {
  decode(input?: Uint8Array, options?: { stream?: boolean }): string
}

type ChunkReader = {
  read(): Promise<{ done: boolean; value?: Uint8Array | string }>
  cancel?(): Promise<void>
  releaseLock?(): void
}

/**
 * Yields the `text/event-stream` events of a `fetch` response as they arrive.
 *
 * Works with any `fetch`:
 * - `xhrStreamingFetch` - its body yields `string` chunks, used as-is.
 * - A standard streaming `fetch` - `Uint8Array` chunks are decoded as UTF-8.
 * - RN's built-in `fetch` - it has no `body`, so the whole response is read
 *   at once and the events arrive together at the end.
 *
 * Leaving the loop early (`break`, `return`, a thrown error) cancels the body,
 * which aborts the underlying request.
 */
export async function* readSse(
  response: Response,
  options: SseParserOptions = {},
): AsyncGenerator<SseEvent> {
  const queue: SseEvent[] = []
  const parser = createSseParser((event) => queue.push(event), options)

  const reader = (
    response as unknown as { body?: { getReader(): ChunkReader } | null }
  ).body?.getReader()

  if (!reader) {
    parser.push(await response.text())
    parser.flush()
    yield* queue
    return
  }

  let decoder: Utf8Decoder | undefined
  let isDone = false

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      if (typeof value === 'string') {
        parser.push(value)
      } else if (value) {
        decoder ??= createDecoder()
        parser.push(decoder.decode(value, { stream: true }))
      }

      while (queue.length) yield queue.shift()!
    }

    isDone = true

    const tail = decoder?.decode()

    if (tail) parser.push(tail)

    parser.flush()

    while (queue.length) yield queue.shift()!
  } finally {
    if (!isDone) await reader.cancel?.().catch(() => undefined)

    reader.releaseLock?.()
  }
}

/**
 * Created lazily: string chunks never need it, and Hermes may have no
 * `TextDecoder` (RN's types don't declare one either).
 */
function createDecoder(): Utf8Decoder {
  const { TextDecoder } = globalThis as unknown as {
    TextDecoder?: new () => Utf8Decoder
  }

  if (!TextDecoder) {
    throw new TypeError(
      'readSse: got a byte chunk but TextDecoder is unavailable. Use xhrStreamingFetch, or polyfill TextDecoder.',
    )
  }

  return new TextDecoder()
}
