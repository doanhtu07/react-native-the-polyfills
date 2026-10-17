export type SseEvent = {
  /** The `event:` field, `'message'` when the server sent none. */
  event: string
  /** Every `data:` line of the event, joined with `\n`. */
  data: string
  /** The last `id:` the stream sent, carried over to later events. */
  id?: string
}

export type SseParserOptions = {
  /** Called with the reconnection delay (ms) whenever the server sends `retry:`. */
  onRetry?: (retry: number) => void
}

export type SseParser = {
  /** Feeds decoded text. Chunks may split anywhere, even between `\r` and `\n`. */
  push(chunk: string): void
  /** End of stream: a final unterminated line still counts, then dispatch. */
  flush(): void
}

/**
 * Incremental `text/event-stream` parser, following WHATWG "interpreting an
 * event stream".
 *
 * - A leading BOM is dropped.
 * - Comment lines (`: ping`) and unknown fields are ignored.
 * - A field's value has at most one leading space stripped, so `data: x` and
 *   `data:x` parse the same.
 * - `id` carries over to later events, and an `id` containing NUL is ignored.
 * - `retry` is reported through `onRetry`. Reconnecting is up to the caller.
 *
 * One deviation from the spec: an event still pending at EOF is dispatched by
 * `flush()` rather than discarded, since some servers end without a trailing
 * blank line.
 */
export function createSseParser(
  onEvent: (event: SseEvent) => void,
  options: SseParserOptions = {},
): SseParser {
  let buffer = ''
  let isStart = true
  let eventName = ''
  let dataLines: string[] = []
  let id: string | undefined

  const dispatch = () => {
    if (dataLines.length) {
      onEvent({ event: eventName || 'message', data: dataLines.join('\n'), id })
    }

    eventName = ''
    dataLines = []
  }

  const processLine = (line: string) => {
    if (line === '') {
      dispatch()
      return
    }

    if (line.startsWith(':')) return

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)

    if (value.startsWith(' ')) value = value.slice(1)

    switch (field) {
      case 'event':
        eventName = value
        break
      case 'data':
        dataLines.push(value)
        break
      case 'id':
        if (!value.includes('\0')) id = value
        break
      case 'retry':
        if (/^\d+$/.test(value)) options.onRetry?.(Number(value))
        break
    }
  }

  const drain = (isFinal: boolean) => {
    let start = 0

    for (let i = 0; i < buffer.length; i++) {
      const ch = buffer[i]

      if (ch !== '\n' && ch !== '\r') continue

      // A trailing `\r` may be the first half of `\r\n` - wait for more input
      if (ch === '\r' && i === buffer.length - 1 && !isFinal) break

      processLine(buffer.slice(start, i))

      if (ch === '\r' && buffer[i + 1] === '\n') i++

      start = i + 1
    }

    buffer = buffer.slice(start)
  }

  return {
    push(chunk) {
      if (isStart && chunk) {
        isStart = false
        if (chunk.startsWith('﻿')) chunk = chunk.slice(1)
      }

      buffer += chunk
      drain(false)
    },

    flush() {
      drain(true)

      if (buffer) {
        processLine(buffer)
        buffer = ''
      }

      dispatch()
    },
  }
}
