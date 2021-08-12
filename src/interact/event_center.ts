import { formatLogMessage } from '../libs/utils'

type eventInfo = {
  data: Record<PropertyKey, unknown>,
  callbacks: Set<CallableFunction>,
}

export default class EventCenter {
  eventList = new Map<string, eventInfo>()

  // whether the name is legal
  isLegalName (name: string): boolean {
    if (!name) {
      console.error(
        formatLogMessage('event-center: Invalid name')
      )
      return false
    }

    return true
  }

  /**
   * add listener
   * @param name event name
   * @param f listener
   * @param autoTrigger If there is cached data when first bind listener, whether it needs to trigger, default is false
   */
  on (name: string, f: CallableFunction, autoTrigger = false): void {
    if (this.isLegalName(name)) {
      if (typeof f !== 'function') {
        return console.error(
          formatLogMessage('event-center: Invalid callback function')
        )
      }

      let eventInfo = this.eventList.get(name)
      if (!eventInfo) {
        eventInfo = {
          data: {},
          callbacks: new Set(),
        }
        this.eventList.set(name, eventInfo)
      } else if (autoTrigger && Object.getOwnPropertyNames(eventInfo.data).length) {
        // auto trigger when data not null
        f(eventInfo.data)
      }

      eventInfo.callbacks.add(f)
    }
  }

  // remove listener, but the data is not cleared
  off (name: string, f?: CallableFunction): void {
    if (this.isLegalName(name)) {
      const eventInfo = this.eventList.get(name)
      if (eventInfo) {
        if (typeof f === 'function') {
          eventInfo.callbacks.delete(f)
        } else {
          eventInfo.callbacks.clear()
        }
      }
    }
  }

  // dispatch data
  dispatch (name: string, data: Record<PropertyKey, unknown>): void {
    if (this.isLegalName(name)) {
      if (toString.call(data) !== '[object Object]') {
        return console.error(
          formatLogMessage('event-center: data must be object')
        )
      }
      let eventInfo = this.eventList.get(name)
      if (eventInfo) {
        // Update when the data is not equal
        if (eventInfo.data !== data) {
          eventInfo.data = data
          for (const f of eventInfo.callbacks) {
            f(data)
          }
        }
      } else {
        eventInfo = {
          data: data,
          callbacks: new Set(),
        }
        this.eventList.set(name, eventInfo)
      }
    }
  }

  // get data
  getData (name: string): Record<PropertyKey, unknown> | null {
    const eventInfo = this.eventList.get(name)
    return eventInfo?.data ?? null
  }
}
