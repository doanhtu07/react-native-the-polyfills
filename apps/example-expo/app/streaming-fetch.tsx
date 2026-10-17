import {
  readSse,
  type SseEvent,
  xhrStreamingFetch,
} from '@the-polyfills/streaming-fetch'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

interface Endpoint {
  id: string
  title: string
  url: string
  description: string
}

const ENDPOINTS: Endpoint[] = [
  {
    id: 'echo',
    title: 'echo.websocket.org',
    url: 'https://echo.websocket.org/.sse',
    description:
      'Named events, a multi-line request echo, then a `time` event every second',
  },
  {
    id: 'wikimedia',
    title: 'Wikimedia recent changes',
    url: 'https://stream.wikimedia.org/v2/stream/recentchange',
    description:
      'High volume, large JSON payloads split across chunks. Never ends - stop it',
  },
  {
    id: 'local',
    title: 'Local server',
    // The Android emulator reaches the host machine through 10.0.2.2
    url: `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:3001`,
    description:
      'Run `node scripts/sse-server.mjs`. 10 events 500ms apart, then ends',
  },
]

type FetchImpl = 'xhrStreamingFetch' | 'fetch'

type RunStatus =
  'idle' | 'connecting' | 'streaming' | 'done' | 'aborted' | 'error'

interface LoggedEvent {
  key: number
  /** ms since the request started */
  at: number
  event: SseEvent
}

/** Keeps the list cheap to render on endless streams. */
const MAX_LOGGED_EVENTS = 50

const MAX_DATA_PREVIEW = 300

export default function StreamingFetch() {
  const [endpoint, setEndpoint] = useState(ENDPOINTS[0])
  const [fetchImpl, setFetchImpl] = useState<FetchImpl>('xhrStreamingFetch')
  const [status, setStatus] = useState<RunStatus>('idle')
  const [detail, setDetail] = useState('Not run yet')
  const [count, setCount] = useState(0)
  const [firstEventAt, setFirstEventAt] = useState<number>()
  const [retry, setRetry] = useState<number>()
  const [events, setEvents] = useState<LoggedEvent[]>([])

  const controllerRef = useRef<AbortController | null>(null)

  const isRunning = status === 'connecting' || status === 'streaming'

  const stop = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  const start = useCallback(async () => {
    stop()

    const controller = new AbortController()
    controllerRef.current = controller

    const startedAt = Date.now()
    let received = 0

    setStatus('connecting')
    setDetail(`GET ${endpoint.url}`)
    setCount(0)
    setFirstEventAt(undefined)
    setRetry(undefined)
    setEvents([])

    try {
      const doFetch = fetchImpl === 'fetch' ? fetch : xhrStreamingFetch

      const response = await doFetch(endpoint.url, {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      setStatus('streaming')
      setDetail(
        `HTTP ${response.status} after ${Date.now() - startedAt}ms, ` +
          `content-type: ${response.headers.get('content-type') ?? '?'}`,
      )

      for await (const event of readSse(response, { onRetry: setRetry })) {
        const at = Date.now() - startedAt

        if (received === 0) setFirstEventAt(at)

        const key = received++

        setCount(received)
        setEvents((prev) =>
          [{ key, at, event }, ...prev].slice(0, MAX_LOGGED_EVENTS),
        )
      }

      setStatus('done')
      setDetail(`Stream ended after ${Date.now() - startedAt}ms`)
    } catch (e) {
      const isAbort = e instanceof Error && e.name === 'AbortError'

      setStatus(isAbort ? 'aborted' : 'error')
      setDetail(
        isAbort
          ? `Aborted after ${Date.now() - startedAt}ms`
          : e instanceof Error
            ? `${e.name}: ${e.message}`
            : String(e),
      )
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [endpoint, fetchImpl, stop])

  // MARK: Effects

  // Don't leave an endless stream running after leaving the screen
  useEffect(() => stop, [stop])

  // MARK: Renderers

  const renderOption = <T,>(
    label: string,
    value: T,
    selected: T,
    onSelect: (value: T) => void,
  ) => (
    <Pressable
      key={label}
      disabled={isRunning}
      style={[
        styles.option,
        value === selected && styles.optionSelected,
        isRunning && styles.disabled,
      ]}
      onPress={() => onSelect(value)}
    >
      <Text
        style={[
          styles.optionText,
          value === selected && styles.optionTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.header}>streaming-fetch</Text>

      <Text style={styles.subheader}>
        Streams Server-Sent Events with xhrStreamingFetch + readSse. Switch to
        the built-in fetch to compare: its events should all arrive at once,
        only after the stream ends
      </Text>

      <View style={styles.divider} />

      <Text style={styles.label}>Endpoint</Text>

      <View style={styles.card}>
        <View style={styles.options}>
          {ENDPOINTS.map((entry) =>
            renderOption(entry.title, entry, endpoint, setEndpoint),
          )}
        </View>

        <Text style={styles.mono}>{endpoint.url}</Text>
        <Text style={styles.cardDescription}>{endpoint.description}</Text>
      </View>

      <Text style={styles.label}>Fetch implementation</Text>

      <View style={styles.options}>
        {renderOption<FetchImpl>(
          'xhrStreamingFetch',
          'xhrStreamingFetch',
          fetchImpl,
          setFetchImpl,
        )}

        {renderOption<FetchImpl>(
          'built-in fetch',
          'fetch',
          fetchImpl,
          setFetchImpl,
        )}
      </View>

      <Pressable
        style={[
          styles.button,
          styles.runButton,
          isRunning && styles.stopButton,
        ]}
        onPress={isRunning ? stop : start}
      >
        <Text style={styles.buttonText}>{isRunning ? 'Stop' : 'Start'}</Text>
      </Pressable>

      <View style={styles.card}>
        <Text
          style={[
            styles.cardTitle,
            status === 'done' && styles.resultPass,
            status === 'error' && styles.resultFail,
          ]}
        >
          ● {status}
        </Text>

        <Text style={styles.cardDescription}>{detail}</Text>

        <Text style={styles.cardDescription}>
          Events: {count}
          {firstEventAt !== undefined && ` · first after ${firstEventAt}ms`}
          {retry !== undefined && ` · retry: ${retry}ms`}
        </Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.label}>
        Latest events (newest first, last {MAX_LOGGED_EVENTS})
      </Text>

      {events.map(({ key, at, event }) => (
        <View key={key} style={styles.card}>
          <Text style={styles.eventMeta}>
            #{key} · +{at}ms · event: {event.event}
            {event.id !== undefined && ` · id: ${event.id}`}
          </Text>

          <Text style={styles.mono}>
            {event.data.length > MAX_DATA_PREVIEW
              ? `${event.data.slice(0, MAX_DATA_PREVIEW)}… (${event.data.length} chars)`
              : event.data}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}

// MARK: Styles

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#f6f6f6',
    borderRadius: 12,
    gap: 4,
    padding: 12,
  },
  cardDescription: {
    color: '#555',
    fontSize: 13,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    gap: 8,
    padding: 16,
    paddingBottom: 64,
  },
  disabled: {
    opacity: 0.5,
  },
  divider: {
    backgroundColor: 'lightgray',
    height: 1,
    marginVertical: 12,
  },
  eventMeta: {
    color: '#0a7ea4',
    fontSize: 12,
    fontWeight: '600',
  },
  header: {
    fontSize: 20,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  option: {
    backgroundColor: '#e8e8e8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  optionSelected: {
    backgroundColor: '#0a7ea4',
  },
  optionText: {
    fontSize: 13,
  },
  optionTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resultFail: {
    color: '#b42318',
  },
  resultPass: {
    color: '#067647',
  },
  root: {
    flex: 1,
  },
  runButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#111',
    marginTop: 12,
  },
  stopButton: {
    backgroundColor: '#b42318',
  },
  subheader: {
    color: '#555',
    fontSize: 13,
  },
})
