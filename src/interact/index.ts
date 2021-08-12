import EventCenter from './event_center'
import { appInstanceMap } from '../create_app'
import { removeDomScope } from '../libs/utils'

const eventCenter = new EventCenter()

/**
 * Format event name
 * @param appName app.name
 * @param fromBaseApp is from base app
 */
function formatEventName (appName: string, fromBaseApp: boolean): string {
  if (typeof appName !== 'string' || !appName) return ''
  return fromBaseApp ? `__from_base_app_${appName}__` : `__from_micro_app_${appName}__`
}

// Global data
class EventCenterForGlobal {
  /**
   * add listener of global data
   * @param cb listener
   * @param autoTrigger If there is cached data when first bind listener, whether it needs to trigger, default is false
   */
  addGlobalDataListener (cb: CallableFunction, autoTrigger?: boolean): void {
    eventCenter.on('global', cb, autoTrigger)
  }

  /**
   * remove listener of global data
   * @param cb listener
   */
  removeGlobalDataListener (cb: CallableFunction): void {
    if (typeof cb === 'function') {
      eventCenter.off('global', cb)
    }
  }

  /**
   * dispatch global data
   * @param data data
   */
  setGlobalData (data: Record<PropertyKey, unknown>): void {
    eventCenter.dispatch('global', data)
  }

  /**
   * clear all listener of global data
   */
  clearGlobalDataListener (): void {
    eventCenter.off('global')
  }
}

// Event center for base app
export class EventCenterForBaseApp extends EventCenterForGlobal {
  /**
   * add listener
   * @param appName app.name
   * @param cb listener
   * @param autoTrigger If there is cached data when first bind listener, whether it needs to trigger, default is false
   */
  addDataListener (appName: string, cb: CallableFunction, autoTrigger?: boolean): void {
    eventCenter.on(formatEventName(appName, false), cb, autoTrigger)
  }

  /**
   * remove listener
   * @param appName app.name
   * @param cb listener
   */
  removeDataListener (appName: string, cb: CallableFunction): void {
    if (typeof cb === 'function') {
      eventCenter.off(formatEventName(appName, false), cb)
    }
  }

  /**
   * get data from micro app or base app
   * @param appName app.name
   * @param fromBaseApp whether get data from base app, default is false
   */
  getData (appName: string, fromBaseApp = false): Record<PropertyKey, unknown> | null {
    return eventCenter.getData(formatEventName(appName, fromBaseApp))
  }

  /**
   * Dispatch data to the specified micro app
   * @param appName app.name
   * @param data data
   */
  setData (appName: string, data: Record<PropertyKey, unknown>): void {
    eventCenter.dispatch(formatEventName(appName, true), data)
  }

  /**
   * clear all listener for specified micro app
   * @param appName app.name
   */
  clearDataListener (appName: string): void {
    eventCenter.off(formatEventName(appName, false))
  }
}

// Event center for micro app
export class EventCenterForMicroApp extends EventCenterForGlobal {
  appName: string
  constructor (appName: string) {
    super()
    this.appName = appName
  }

  /**
   * add listener, monitor the data sent by the base app
   * @param cb listener
   * @param autoTrigger If there is cached data when first bind listener, whether it needs to trigger, default is false
   */
  addDataListener (cb: CallableFunction, autoTrigger?: boolean): void {
    eventCenter.on(formatEventName(this.appName, true), cb, autoTrigger)
  }

  /**
   * remove listener
   * @param cb listener
   */
  removeDataListener (cb: CallableFunction): void {
    if (typeof cb === 'function') {
      eventCenter.off(formatEventName(this.appName, true), cb)
    }
  }

  /**
   * get data from base app
   */
  getData (): Record<PropertyKey, unknown> | null {
    return eventCenter.getData(formatEventName(this.appName, true))
  }

  /**
   * dispatch data to base app
   * @param data data
   */
  dispatch (data: Record<PropertyKey, unknown>): void {
    removeDomScope()

    eventCenter.dispatch(formatEventName(this.appName, false), data)

    const app = appInstanceMap.get(this.appName)
    if (app?.container && toString.call(data) === '[object Object]') {
      const event = new CustomEvent('datachange', {
        detail: {
          data,
        }
      })

      let element = app.container
      if (element instanceof ShadowRoot) {
        element = element.host as HTMLElement
      }
      element.dispatchEvent(event)
    }
  }

  /**
   * clear all listeners
   */
  clearDataListener (): void {
    eventCenter.off(formatEventName(this.appName, true))
  }
}
