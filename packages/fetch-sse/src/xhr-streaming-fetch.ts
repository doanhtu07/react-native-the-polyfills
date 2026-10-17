type ReadResult =
  { done: true; value: undefined } | { done: false; value: string }

/** Matches the `DOMException` browsers reject aborted fetches with - Hermes has none. */
function createAbortError(): Error {
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

/**
 * A `fetch` that streams response bodies on React Native.
 *
 * RN's built-in `fetch` (whatwg-fetch over `XMLHttpRequest`) resolves only once
 * the whole body arrived and has no `response.body`. RN's `XMLHttpRequest`
 * itself does deliver text incrementally while a `readystatechange` listener
 * is attached, so this resolves as soon as headers arrive and feeds every new
 * slice of `responseText` to `response.body.getReader()`.
 *
 * Chunks are `string`s, not bytes - Hermes has no `TextDecoder`. Consumers that
 * expect `Uint8Array` must handle both - `readSse` does.
 *
 * Only what streaming consumers use is implemented: `ok`, `status`,
 * `statusText`, `headers`, `url`, `body.getReader()`, `text()` and `json()`.
 * The body can be read once, through either the reader or `text()`/`json()`.
 *
 * The server must flush each chunk and not compress the response, otherwise
 * it arrives in one piece regardless.
 */
export const xhrStreamingFetch = ((
  input: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> => {
  // MARK: Variables + States

  const { signal } = init

  const url =
    typeof input === 'string'
      ? input
      : 'url' in input
        ? input.url
        : input.toString()

  const xhr = new XMLHttpRequest()

  /** Text received but not read yet. */
  const chunks: string[] = []

  /** Reader calls waiting for the next chunk, end, or failure. */
  let waiting: Array<{
    resolve: (result: ReadResult) => void
    reject: (error: unknown) => void
  }> = []

  let offset = 0
  let isDone = false
  let failure: unknown
  let resolveResponse: (response: Response) => void = () => undefined
  let rejectResponse: (error: unknown) => void = () => undefined
  let hasResponse = false

  // MARK: Body

  const flush = () => {
    while (waiting.length && chunks.length) {
      waiting.shift()!.resolve({ done: false, value: chunks.shift()! })
    }

    if (!waiting.length || chunks.length) return

    if (failure !== undefined) {
      waiting.forEach((waiter) => waiter.reject(failure))
      waiting = []
    } else if (isDone) {
      waiting.forEach((waiter) =>
        waiter.resolve({ done: true, value: undefined }),
      )
      waiting = []
    }
  }

  const pushNewText = () => {
    const text = xhr.responseText

    if (text.length > offset) {
      chunks.push(text.slice(offset))
      offset = text.length
    }
  }

  const fail = (error: unknown) => {
    if (isDone || failure !== undefined) return

    failure = error

    if (hasResponse) {
      flush()
    } else {
      rejectResponse(error)
    }
  }

  const read = (): Promise<ReadResult> =>
    new Promise((resolve, reject) => {
      waiting.push({ resolve, reject })
      flush()
    })

  const readAll = async (): Promise<string> => {
    let text = ''

    while (true) {
      const result = await read()
      if (result.done) return text
      text += result.value
    }
  }

  const body = {
    getReader: () => ({
      read,
      releaseLock: () => undefined,
      cancel: async () => xhr.abort(),
    }),
  }

  // MARK: Response

  const createResponse = (): Response => {
    const headers = new Headers()

    xhr
      .getAllResponseHeaders()
      .trim()
      .split(/[\r\n]+/)
      .forEach((line) => {
        const index = line.indexOf(':')
        if (index > 0) {
          headers.append(
            line.slice(0, index).trim(),
            line.slice(index + 1).trim(),
          )
        }
      })

    return {
      ok: xhr.status >= 200 && xhr.status < 300,
      status: xhr.status,
      statusText: xhr.statusText,
      headers,
      url: xhr.responseURL || url,
      body,
      text: readAll,
      json: async () => JSON.parse(await readAll()),
    } as unknown as Response
  }

  // MARK: XHR

  return new Promise<Response>((resolve, reject) => {
    resolveResponse = resolve
    rejectResponse = reject

    if (signal?.aborted) {
      reject(createAbortError())
      return
    }

    xhr.open(init.method ?? 'GET', url, true)
    xhr.responseType = 'text'
    xhr.withCredentials = init.credentials !== 'omit'

    // RN's and `@types/node`'s fetch globals both load and disagree on `Headers`.
    new Headers(
      init.headers as ConstructorParameters<typeof Headers>[0],
    ).forEach((value, key) => xhr.setRequestHeader(key, value))

    const respond = () => {
      if (hasResponse || failure !== undefined) return

      hasResponse = true
      resolveResponse(createResponse())
    }

    // Attaching this listener is what makes RN deliver `LOADING` updates.
    // `DONE` is left to `onload`: on failure RN replaces `responseText` with
    // the error message before reaching it.
    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        respond()
      } else if (xhr.readyState === XMLHttpRequest.LOADING) {
        respond()
        pushNewText()
        flush()
      }
    }

    xhr.onload = () => {
      respond()
      pushNewText()
      isDone = true
      flush()
    }

    xhr.onerror = () => fail(new TypeError('Network request failed'))
    xhr.ontimeout = () => fail(new TypeError('Network request timed out'))
    xhr.onabort = () => fail(createAbortError())

    signal?.addEventListener('abort', () => xhr.abort())

    xhr.send((init.body as Parameters<XMLHttpRequest['send']>[0]) ?? null)
  })
}) as typeof fetch
