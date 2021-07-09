import { formatLogMessage } from '../libs/utils'

type eventInfo = {
  data: Record<PropertyKey, unknown>,
  callbacks: Set<CallableFunction>,
}

export default class EventCenter {
  eventList = new Map<string, eventInfo>()

  // 判断名称是否正确
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
   * 绑定监听函数
   * @param name 事件名称
   * @param f 绑定函数
   * @param autoTrigger 在初次绑定监听函数时有缓存数据，是否需要主动触发一次，默认为false
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
        // 如果数据池中有数据，绑定时主动触发一次
        f(eventInfo.data)
      }

      eventInfo.callbacks.add(f)
    }
  }

  // 解除绑定，但数据不清空
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

  // 发送数据
  dispatch (name: string, data: Record<PropertyKey, unknown>): void {
    if (this.isLegalName(name)) {
      if (toString.call(data) !== '[object Object]') {
        return console.error(
          formatLogMessage('event-center: data must be object')
        )
      }
      let eventInfo = this.eventList.get(name)
      if (eventInfo) {
        // 当数据不相等时才更新
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

  // 获取数据
  getData (name: string): Record<PropertyKey, unknown> | null {
    const eventInfo = this.eventList.get(name)
    return eventInfo?.data ?? null
  }
}
