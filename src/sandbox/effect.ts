import type { microWindowType } from '@micro-app/types'
import { getCurrentAppName, formatLogMessage } from '../libs/utils'

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
    return console.warn(
      formatLogMessage('Cannot redefine document property onclick')
    )
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
const documentEventListenerMap = new Map<string, Map<string, Set<EventListenerOrEventListenerObject>>>()
export function effectDocumentEvent (): void {
  if (!hasRewriteDocumentOnClick) {
    overwriteDocumentOnClick()
  }
  document.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
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
    }
    return rawDocumentAddEventListener.call(document, type, listener, options)
  }

  document.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
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
    return rawDocumentRemoveEventListener.call(document, type, listener, options)
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
export default function effect (microWindow: microWindowType): CallableFunction {
  const eventListenerMap = new Map<string, Set<EventListenerOrEventListenerObject>>()
  const intervalIdList = new Set<number>()
  const timeoutIdList = new Set<number>()

  microWindow.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    type = formatEventType(type, microWindow)
    const listenerList = eventListenerMap.get(type)
    if (listenerList) {
      listenerList.add(listener)
    } else {
      eventListenerMap.set(type, new Set([listener]))
    }
    return rawWindowAddEventListener.call(window, type, listener, options)
  }

  microWindow.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    type = formatEventType(type, microWindow)
    const listenerList = eventListenerMap.get(type)
    if (listenerList?.size && listenerList.has(listener)) {
      listenerList.delete(listener)
    }
    return rawWindowRemoveEventListener.call(window, type, listener, options)
  }

  microWindow.setInterval = function (
    handler: TimerHandler,
    timeout?: number,
    ...args: any[]
  ): number {
    const intervalId = rawSetInterval(handler, timeout, ...args)
    intervalIdList.add(intervalId)
    return intervalId
  }

  microWindow.setTimeout = function (
    handler: TimerHandler,
    timeout?: number,
    ...args: any[]
  ): number {
    const timeoutId = rawSetTimeout(handler, timeout, ...args)
    timeoutIdList.add(timeoutId)
    return timeoutId
  }

  microWindow.clearInterval = function (intervalId: number) {
    intervalIdList.delete(intervalId)
    rawClearInterval(intervalId)
  }

  microWindow.clearTimeout = function (timeoutId: number) {
    timeoutIdList.delete(timeoutId)
    rawClearTimeout(timeoutId)
  }

  return () => {
    // Clear window binding events
    if (eventListenerMap.size) {
      eventListenerMap.forEach((listenerList, type) => {
        if (listenerList.size) {
          for (const listener of listenerList) {
            rawWindowRemoveEventListener.call(window, type, listener)
          }
        }
      })
      eventListenerMap.clear()
    }

    // Clear timers
    if (intervalIdList.size) {
      intervalIdList.forEach((intervalId: number) => {
        rawClearInterval(intervalId)
      })
      intervalIdList.clear()
    }

    if (timeoutIdList.size) {
      timeoutIdList.forEach((timeoutId: number) => {
        rawClearTimeout(timeoutId)
      })
      timeoutIdList.clear()
    }

    const appName = microWindow.__MICRO_APP_NAME__

    // Clear the function bound by micro application through document.onclick
    documentClickListMap.delete(appName)

    // Clear document binding event
    const documentAppListenersMap = documentEventListenerMap.get(appName)
    if (documentAppListenersMap) {
      documentAppListenersMap.forEach((listenerList, type) => {
        if (listenerList.size) {
          for (const listener of listenerList) {
            rawDocumentRemoveEventListener.call(document, type, listener)
          }
        }
      })
      documentAppListenersMap.clear()
    }
  }
}
