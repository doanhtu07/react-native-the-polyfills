import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import { xhrStreamingFetch } from '../xhr-streaming-fetch'

/** Drives the `XMLHttpRequest` lifecycle by hand, the way RN's networking does. */
class FakeXhr {
  static readonly UNSENT = 0
  static readonly OPENED = 1
  static readonly HEADERS_RECEIVED = 2
  static readonly LOADING = 3
  static readonly DONE = 4

  static last: FakeXhr

  readyState = FakeXhr.UNSENT
  status = 0
  statusText = ''
  responseText = ''
  responseURL = ''
  responseType = ''
  withCredentials = false

  method = ''
  url = ''
  body: unknown
  requestHeaders: Record<string, string> = {}

  onreadystatechange: (() => void) | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  onabort: (() => void) | null = null

  constructor() {
    FakeXhr.last = this
  }

  open(method: string, url: string) {
    this.method = method
    this.url = url
    this.readyState = FakeXhr.OPENED
  }

  setRequestHeader(key: string, value: string) {
    this.requestHeaders[key] = value
  }

  getAllResponseHeaders() {
    return 'content-type: text/event-stream\r\nx-test: 1\r\n'
  }

  send(body: unknown) {
    this.body = body
  }

  abort() {
    this.readyState = FakeXhr.DONE
    this.onreadystatechange?.()
    this.onabort?.()
  }

  // MARK: Test drivers

  receiveHeaders(status = 200) {
    this.status = status
    this.readyState = FakeXhr.HEADERS_RECEIVED
    this.onreadystatechange?.()
  }

  receive(text: string) {
    this.responseText += text
    this.readyState = FakeXhr.LOADING
    this.onreadystatechange?.()
  }

  finish() {
    this.readyState = FakeXhr.DONE
    this.onreadystatechange?.()
    this.onload?.()
  }

  failNetwork() {
    // RN overwrites `responseText` with the error before reaching `DONE`
    this.responseText = 'Could not connect'
    this.status = 0
    this.readyState = FakeXhr.DONE
    this.onreadystatechange?.()
    this.onerror?.()
  }
}

/** RN's `Response` type has no `body`, but `xhrStreamingFetch` provides one. */
function getReader(response: Response) {
  return (
    response as unknown as {
      body: { getReader(): { read(): Promise<unknown> } }
    }
  ).body.getReader()
}

const originalXhr = globalThis.XMLHttpRequest

beforeEach(() => {
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest
})

afterEach(() => {
  globalThis.XMLHttpRequest = originalXhr
})

describe('xhrStreamingFetch', () => {
  it('sends the request and resolves on headers', async () => {
    const promise = xhrStreamingFetch('http://x/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', sitecode: 'CPRTUS' },
      body: '{"a":1}',
      credentials: 'include',
    })

    const xhr = FakeXhr.last
    xhr.receiveHeaders(201)

    const response = await promise

    expect(xhr.method).toBe('POST')
    expect(xhr.url).toBe('http://x/message')
    expect(xhr.body).toBe('{"a":1}')
    expect(xhr.withCredentials).toBe(true)
    expect(xhr.requestHeaders).toEqual({
      'content-type': 'application/json',
      sitecode: 'CPRTUS',
    })
    expect(response.ok).toBe(true)
    expect(response.status).toBe(201)
    expect(response.headers.get('x-test')).toBe('1')
  })

  it('streams each new slice of text before the request ends', async () => {
    const promise = xhrStreamingFetch('http://x')
    const xhr = FakeXhr.last
    xhr.receiveHeaders()

    const reader = getReader(await promise)

    xhr.receive('event: message\n')
    expect(await reader.read()).toEqual({
      done: false,
      value: 'event: message\n',
    })

    const pending = reader.read()
    xhr.receive('data: {}\n\n')
    expect(await pending).toEqual({ done: false, value: 'data: {}\n\n' })

    xhr.finish()
    expect(await reader.read()).toEqual({ done: true, value: undefined })
  })

  it('reads the whole body with text() and json()', async () => {
    const promise = xhrStreamingFetch('http://x')
    const xhr = FakeXhr.last
    xhr.receiveHeaders()
    xhr.receive('{"session_id":')
    xhr.receive('"s1"}')
    xhr.finish()

    expect(await (await promise).json()).toEqual({ session_id: 's1' })
  })

  it('reports non-2xx responses without rejecting', async () => {
    const promise = xhrStreamingFetch('http://x')
    const xhr = FakeXhr.last
    xhr.receiveHeaders(500)
    xhr.receive('boom')
    xhr.finish()

    const response = await promise

    expect(response.ok).toBe(false)
    expect(await response.text()).toBe('boom')
  })

  it('rejects on a network failure before headers', async () => {
    const promise = xhrStreamingFetch('http://x')
    FakeXhr.last.failNetwork()

    await expect(promise).rejects.toThrow('Network request failed')
  })

  it('fails a pending read, without the error text, when the stream breaks', async () => {
    const promise = xhrStreamingFetch('http://x')
    const xhr = FakeXhr.last
    xhr.receiveHeaders()

    const reader = getReader(await promise)

    xhr.receive('partial')
    expect(await reader.read()).toEqual({ done: false, value: 'partial' })

    const pending = reader.read()
    xhr.failNetwork()

    await expect(pending).rejects.toThrow('Network request failed')
  })

  it('aborts through the signal', async () => {
    const controller = new AbortController()
    const promise = xhrStreamingFetch('http://x', {
      signal: controller.signal as RequestInit['signal'],
    })
    const xhr = FakeXhr.last
    xhr.receiveHeaders()

    const reader = getReader(await promise)
    const pending = reader.read()

    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      xhrStreamingFetch('http://x', {
        signal: controller.signal as RequestInit['signal'],
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
