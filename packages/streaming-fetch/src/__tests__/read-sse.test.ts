import { describe, expect, it } from '@jest/globals'
import type { SseParserOptions } from '../create-sse-parser'
import { readSse } from '../read-sse'

/** A minimal `Response` whose body hands out `chunks` one `read()` at a time. */
function streamingResponse(chunks: Array<string | Uint8Array>) {
  const state = { cancelled: false, released: false }
  let index = 0

  const response = {
    body: {
      getReader: () => ({
        read: async () =>
          index < chunks.length
            ? { done: false, value: chunks[index++] }
            : { done: true, value: undefined },
        cancel: async () => {
          state.cancelled = true
        },
        releaseLock: () => {
          state.released = true
        },
      }),
    },
  } as unknown as Response

  return { response, state }
}

async function collect(response: Response, options?: SseParserOptions) {
  const events = []
  for await (const event of readSse(response, options)) events.push(event)
  return events
}

/** UTF-8 bytes of `text`; only `é` is non-ASCII in these tests. */
function utf8(text: string) {
  return Uint8Array.from(
    [...text].flatMap((ch) => (ch === 'é' ? [0xc3, 0xa9] : [ch.charCodeAt(0)])),
  )
}

describe('readSse', () => {
  it('parses string chunks, as xhrStreamingFetch yields', async () => {
    const { response, state } = streamingResponse([
      'event: a\nda',
      'ta: 1\n\nda',
      'ta: 2\n\n',
    ])

    expect(await collect(response)).toEqual([
      { event: 'a', data: '1', id: undefined },
      { event: 'message', data: '2', id: undefined },
    ])
    expect(state).toEqual({ cancelled: false, released: true })
  })

  it('decodes byte chunks, including a character split across them', async () => {
    const bytes = utf8('data: héllo\n\n')
    const split = bytes.indexOf(0xc3) + 1
    const { response } = streamingResponse([
      bytes.slice(0, split),
      bytes.slice(split),
    ])

    expect(await collect(response)).toEqual([
      { event: 'message', data: 'héllo', id: undefined },
    ])
  })

  it('yields each event before the next chunk is read', async () => {
    const { response } = streamingResponse(['data: 1\n\n', 'data: 2\n\n'])
    const iterator = readSse(response)

    expect((await iterator.next()).value?.data).toBe('1')
    expect((await iterator.next()).value?.data).toBe('2')
    expect((await iterator.next()).done).toBe(true)
  })

  it('falls back to text() when the response has no body', async () => {
    const response = {
      body: null,
      text: async () => 'data: a\n\ndata: b',
    } as unknown as Response

    expect((await collect(response)).map((e) => e.data)).toEqual(['a', 'b'])
  })

  it('cancels the body when the consumer stops early', async () => {
    const { response, state } = streamingResponse([
      'data: 1\n\n',
      'data: 2\n\n',
    ])

    for await (const event of readSse(response)) {
      expect(event.data).toBe('1')
      break
    }

    expect(state).toEqual({ cancelled: true, released: true })
  })

  it('throws a clear error for byte chunks without TextDecoder', async () => {
    const g = globalThis as { TextDecoder?: unknown }
    const original = g.TextDecoder
    delete g.TextDecoder

    try {
      const { response, state } = streamingResponse([utf8('data: x\n\n')])

      await expect(collect(response)).rejects.toThrow('TextDecoder')
      expect(state.cancelled).toBe(true)
    } finally {
      g.TextDecoder = original
    }
  })

  it('passes retry values to onRetry', async () => {
    const { response } = streamingResponse(['retry: 1000\ndata: x\n\n'])
    const retries: number[] = []

    await collect(response, { onRetry: (r) => retries.push(r) })

    expect(retries).toEqual([1000])
  })
})
