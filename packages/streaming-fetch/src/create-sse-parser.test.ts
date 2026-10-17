import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createSseParser,
  type SseEvent,
  type SseParserOptions,
} from './create-sse-parser.js'

function parseAll(chunks: string[], options?: SseParserOptions) {
  const events: SseEvent[] = []
  const parser = createSseParser((e) => events.push(e), options)

  for (const chunk of chunks) parser.push(chunk)
  parser.flush()

  return events
}

// `data: ` with a space, plus `: ping` heartbeats
const SPACED = `: ping

id: 0
event: message
data: {"text": "Hello"}

id: 1
event: message
data: {"done": true}

id: 2
event: done
data: Stream completed

`

// Spring's `SseEmitter` style, no space after the colon
const COMPACT = `id:0
event:message
data:{"text": "Hello"}

id:1
event:message
data:{"done": true}

id:2
event:done
data:Stream completed

`

describe('createSseParser', () => {
  it('parses spaced framing and drops comments', () => {
    const events = parseAll([SPACED])

    assert.deepEqual(
      events.map((e) => e.event),
      ['message', 'message', 'done'],
    )
    assert.equal(JSON.parse(events[0]!.data).text, 'Hello')
    assert.equal(events[2]!.data, 'Stream completed')
  })

  it('parses framing without a space after the colon', () => {
    const events = parseAll([COMPACT])

    assert.deepEqual(
      events.map((e) => [e.event, e.id]),
      [
        ['message', '0'],
        ['message', '1'],
        ['done', '2'],
      ],
    )
    assert.equal(JSON.parse(events[1]!.data).done, true)
  })

  it('handles chunks split anywhere, including inside CRLF', () => {
    const crlf = SPACED.split('\n').join('\r\n')
    const chunks = crlf.match(/[\s\S]{1,7}/g)!

    assert.deepEqual(parseAll(chunks), parseAll([SPACED]))
  })

  it('treats a lone CR as a line ending', () => {
    assert.deepEqual(parseAll(['data: a\r\rdata: b\r\r']), [
      { event: 'message', data: 'a', id: undefined },
      { event: 'message', data: 'b', id: undefined },
    ])
  })

  it('joins multi-line data and defaults the event name', () => {
    assert.deepEqual(parseAll(['data: a\ndata: b\n\n']), [
      { event: 'message', data: 'a\nb', id: undefined },
    ])
  })

  it('flushes a final event with no trailing blank line', () => {
    assert.deepEqual(parseAll(['event: done\ndata: end']), [
      { event: 'done', data: 'end', id: undefined },
    ])
  })

  it('skips events with no data', () => {
    assert.deepEqual(parseAll(['event: ping\n\ndata: x\n\n']), [
      { event: 'message', data: 'x', id: undefined },
    ])
  })

  it('drops a leading BOM, even in its own chunk', () => {
    assert.deepEqual(parseAll(['﻿data: a\n\n']), parseAll(['data: a\n\n']))
    assert.deepEqual(
      parseAll(['', '﻿', 'data: a\n\n']),
      parseAll(['data: a\n\n']),
    )
  })

  it('carries the last id over to later events', () => {
    assert.deepEqual(
      parseAll(['id: 7\ndata: a\n\ndata: b\n\n']).map((e) => e.id),
      ['7', '7'],
    )
  })

  it('ignores an id containing NUL', () => {
    assert.deepEqual(
      parseAll(['id: 1\ndata: a\n\nid: 2\0\ndata: b\n\n']).map((e) => e.id),
      ['1', '1'],
    )
  })

  it('reports numeric retry values only', () => {
    const retries: number[] = []

    parseAll(['retry: 3000\nretry: soon\nretry:500\n\n'], {
      onRetry: (r) => retries.push(r),
    })

    assert.deepEqual(retries, [3000, 500])
  })
})
