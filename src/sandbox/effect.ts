import type { microWindowType } from '@micro-app/types'
import { getCurrentAppName, setCurrentAppName, logWarn } from '../libs/utils'

type MicroEventListener = EventListenerOrEventListenerObject & Record<string, any>
type timeInfo = {handler: TimerHandler, timeout: number | undefined, args: any[]}

// save raw methods
const rawWindowAddEventListener = window.addEventListener
const rawWindowRemoveEventListener = window.removeEventListener
const rawSetInterval = window.setInterval
const rawSetTimeout = window.setTimeout
const rawClearInterval = window.clearInterval
const rawClearTimeout = window.clearTimeout

const rawDocumentAddEventListener = document.addEventListener
const rawDocumentRemoveEventListener = document.removeEventListener

// document.onclick binding list, the binding function of each application is unique
const documentClickListMap = new Map<string, unknown>()
let hasRewriteDocumentOnClick = false
/**
 * Rewrite document.onclick and execute it only once
 */
function overwriteDocumentOnClick (): void {
  hasRewriteDocumentOnClick = true
  const descriptor = Object.getOwnPropertyDescriptor(document, 'onclick')
  if (descriptor?.configurable === false) {
    return logWarn('Cannot redefine document property onclick')
  }
  const rawOnClick = document.onclick
  document.onclick = null
  let hasDocumentClickInited = false

  function onClickHandler (e: Event) {
    documentClickListMap.forEach((f) => {
      typeof f === 'function' && f.call(document, e)
    })
  }

  Object.defineProperty(document, 'onclick', {
    configurable: false,
    enumerable: true,
    get () {
      const appName = getCurrentAppName()
      return appName ? documentClickListMap.get(appName) : documentClickListMap.get('base')
    },
    set (f) {
      const appName = getCurrentAppName()
      if (appName) {
        documentClickListMap.set(appName, f)
      } else {
        documentClickListMap.set('base', f)
      }

      if (!hasDocumentClickInited && typeof f === 'function') {
        hasDocumentClickInited = true
        rawDocumentAddEventListener.call(document, 'click', onClickHandler, false)
      }
    }
  })

  if (rawOnClick) {
    document.onclick = rawOnClick
  }
}

/**
 * The document event is globally, we need to clear these event bindings when micro application unmounted
 */
const documentEventListenerMap = new Map<string, Map<string, Set<MicroEventListener>>>()
export function effectDocumentEvent (): void {
  if (!hasRewriteDocumentOnClick) {
    overwriteDocumentOnClick()
  }

  document.addEventListener = function (
    type: string,
    listener: MicroEventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    const appName = getCurrentAppName()
    if (appName) {
      const appListenersMap = documentEventListenerMap.get(appName)
      if (appListenersMap) {
        const appListenerList = appListenersMap.get(type)
        if (appListenerList) {
          appListenerList.add(listener)
        } else {
          appListenersMap.set(type, new Set([listener]))
        }
      } else {
        documentEventListenerMap.set(appName, new Map([[type, new Set([listener])]]))
      }
      listener && (listener.__MICRO_MARK_OPTIONS__ = options)
    }
    rawDocumentAddEventListener.call(document, type, listener, options)
  }

  document.removeEventListener = function (
    type: string,
    listener: MicroEventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const appName = getCurrentAppName()
    if (appName) {
      const appListenersMap = documentEventListenerMap.get(appName)
      if (appListenersMap) {
        const appListenerList = appListenersMap.get(type)
        if (appListenerList?.size && appListenerList.has(listener)) {
          appListenerList.delete(listener)
        }
      }
    }
    rawDocumentRemoveEventListener.call(document, type, listener, options)
  }
}

// Clear the document event agent
export function releaseEffectDocumentEvent (): void {
  document.addEventListener = rawDocumentAddEventListener
  document.removeEventListener = rawDocumentRemoveEventListener
}

/**
 * Format event name
 * @param type event name
 * @param microWindow micro window
 */
function formatEventType (type: string, microWindow: microWindowType): string {
  if (type === 'unmount') {
    return `unmount-${microWindow.__MICRO_APP_NAME__}`
  }
  return type
}

/**
 * Rewrite side-effect events
 * @param microWindow micro window
 */
export default function effect (microWindow: microWindowType): Record<string, CallableFunction> {
  const appName = microWindow.__MICRO_APP_NAME__
  const eventListenerMap = new Map<string, Set<MicroEventListener>>()
  const intervalIdMap = new Map<number, timeInfo>()
  const timeoutIdMap = new Map<number, timeInfo>()

  // listener may be null, e.g test-passive
  microWindow.addEventListener = function (
    type: string,
    listener: MicroEventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    type = formatEventType(type, microWindow)
    const listenerList = eventListenerMap.get(type)
    if (listenerList) {
      listenerList.add(listener)
    } else {
      eventListenerMap.set(type, new Set([listener]))
    }
    listener && (listener.__MICRO_MARK_OPTIONS__ = options)
    rawWindowAddEventListener.call(window, type, listener, options)
  }

  microWindow.removeEventListener = function (
    type: string,
    listener: MicroEventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    type = formatEventType(type, microWindow)
    const listenerList = eventListenerMap.get(type)
    if (listenerList?.size && listenerList.has(listener)) {
      listenerList.delete(listener)
    }
    rawWindowRemoveEventListener.call(window, type, listener, options)
  }

  microWindow.setInterval = function (
    handler: TimerHandler,
    timeout?: number,
    ...args: any[]
  ): number {
    const intervalId = rawSetInterval(handler, timeout, ...args)
    intervalIdMap.set(intervalId, { handler, timeout, args })
    return intervalId
  }

  microWindow.setTimeout = function (
    handler: TimerHandler,
    timeout?: number,
    ...args: any[]
  ): number {
    const timeoutId = rawSetTimeout(handler, timeout, ...args)
    timeoutIdMap.set(timeoutId, { handler, timeout, args })
    return timeoutId
  }

  microWindow.clearInterval = function (intervalId: number) {
    intervalIdMap.delete(intervalId)
    rawClearInterval(intervalId)
  }

  microWindow.clearTimeout = function (timeoutId: number) {
    timeoutIdMap.delete(timeoutId)
    rawClearTimeout(timeoutId)
  }

  const umdWindowListenerMap = new Map<string, Set<MicroEventListener>>()
  const umdDocumentListenerMap = new Map<string, Set<MicroEventListener>>()
  let umdIntervalIdMap = new Map<number, timeInfo>()
  let umdTimeoutIdMap = new Map<number, timeInfo>()
  let umdonClickHander: unknown

  // record event and timer before exec umdMountHook
  const recordUmdEffect = () => {
    // record window event
    eventListenerMap.forEach((listenerList, type) => {
      if (listenerList.size) {
        umdWindowListenerMap.set(type, new Set(listenerList))
      }
    })

    // record timers
    if (intervalIdMap.size) {
      umdIntervalIdMap = new Map(intervalIdMap)
    }

    if (timeoutIdMap.size) {
      umdTimeoutIdMap = new Map(timeoutIdMap)
    }

    // record onclick hander
    umdonClickHander = documentClickListMap.get(appName)

    // record document event
    const documentAppListenersMap = documentEventListenerMap.get(appName)
    if (documentAppListenersMap) {
      documentAppListenersMap.forEach((listenerList, type) => {
        if (listenerList.size) {
          umdDocumentListenerMap.set(type, new Set(listenerList))
        }
      })
    }
  }

  // rebuild event and timer before remount umd app
  const rebuildUmdEffect = () => {
    // rebuild window event
    umdWindowListenerMap.forEach((listenerList, type) => {
      for (const listener of listenerList) {
        microWindow.addEventListener(type, listener, listener?.__MICRO_MARK_OPTIONS__)
      }
    })

    // rebuild timer
    umdIntervalIdMap.forEach((info: timeInfo) => {
      microWindow.setInterval(info.handler, info.timeout, ...info.args)
    })

    umdTimeoutIdMap.forEach((info: timeInfo) => {
      microWindow.setTimeout(info.handler, info.timeout, ...info.args)
    })

    // rebuild onclick event
    umdonClickHander && documentClickListMap.set(appName, umdonClickHander)

    // rebuild document event
    setCurrentAppName(appName)
    umdDocumentListenerMap.forEach((listenerList, type) => {
      for (const listener of listenerList) {
        document.addEventListener(type, listener, listener?.__MICRO_MARK_OPTIONS__)
      }
    })
    setCurrentAppName(null)
  }

  // release all event listener & interval & timeout when unmount app
  const releaseEffect = () => {
    // Clear window binding events
    if (eventListenerMap.size) {
      eventListenerMap.forEach((listenerList, type) => {
        for (const listener of listenerList) {
          rawWindowRemoveEventListener.call(window, type, listener)
        }
      })
      eventListenerMap.clear()
    }

    // Clear timers
    if (intervalIdMap.size) {
      intervalIdMap.forEach((_, intervalId: number) => {
        rawClearInterval(intervalId)
      })
      intervalIdMap.clear()
    }

    if (timeoutIdMap.size) {
      timeoutIdMap.forEach((_, timeoutId: number) => {
        rawClearTimeout(timeoutId)
      })
      timeoutIdMap.clear()
    }

    // Clear the function bound by micro application through document.onclick
    documentClickListMap.delete(appName)

    // Clear document binding event
    const documentAppListenersMap = documentEventListenerMap.get(appName)
    if (documentAppListenersMap) {
      documentAppListenersMap.forEach((listenerList, type) => {
        for (const listener of listenerList) {
          rawDocumentRemoveEventListener.call(document, type, listener)
        }
      })
      documentAppListenersMap.clear()
    }
  }

  return {
    recordUmdEffect,
    rebuildUmdEffect,
    releaseEffect,
  }
}
