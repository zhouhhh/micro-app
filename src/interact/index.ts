import EventCenter from './event_center'
import { appInstanceMap } from '../create_app'
import { removeDomScope } from '../libs/utils'

const eventCenter = new EventCenter()

/**
 * 格式化事件名称
 * @param appName 应用名称
 * @param fromBaseApp 是否从基座应用发送数据
 */
function formatEventName (appName: string, fromBaseApp: boolean): string {
  if (typeof appName !== 'string' || !appName) return ''
  return fromBaseApp ? `__from_base_app_${appName}__` : `__from_micro_app_${appName}__`
}

// 全局数据通信
class EventCenterForGlobal {
  /**
   * 添加全局数据监听
   * @param cb 绑定函数
   * @param autoTrigger 在初次绑定监听函数时有缓存数据，是否需要主动触发一次，默认为false
   */
  addGlobalDataListener (cb: CallableFunction, autoTrigger?: boolean): void {
    eventCenter.on('global', cb, autoTrigger)
  }

  /**
   * 解除全局数据监听函数
   * @param cb 绑定函数
   */
  removeGlobalDataListener (cb: CallableFunction): void {
    if (typeof cb === 'function') {
      eventCenter.off('global', cb)
    }
  }

  /**
   * 发送数据
   * @param data 对象数据
   */
  setGlobalData (data: Record<PropertyKey, unknown>): void {
    eventCenter.dispatch('global', data)
  }

  /**
   * 清空所有全局数据绑定函数
   */
  clearGlobalDataListener (): void {
    eventCenter.off('global')
  }
}

// 基座应用的数据通信方法集合
export class EventCenterForBaseApp extends EventCenterForGlobal {
  /**
   * 添加数据监听
   * @param appName 子应用名称
   * @param cb 绑定函数
   * @param autoTrigger 在初次绑定监听函数时有缓存数据，是否需要主动触发一次，默认为false
   */
  addDataListener (appName: string, cb: CallableFunction, autoTrigger?: boolean): void {
    eventCenter.on(formatEventName(appName, false), cb, autoTrigger)
  }

  /**
   * 解除监听函数
   * @param appName 子应用名称
   * @param cb 绑定函数
   */
  removeDataListener (appName: string, cb: CallableFunction): void {
    if (typeof cb === 'function') {
      eventCenter.off(formatEventName(appName, false), cb)
    }
  }

  /**
   * 主动获取子应用或基座传递的数据
   * @param appName 子应用名称
   * @param fromBaseApp 是否获取基座应用发送给子应用的数据，默认false
   */
  getData (appName: string, fromBaseApp = false): Record<PropertyKey, unknown> | null {
    return eventCenter.getData(formatEventName(appName, fromBaseApp))
  }

  /**
   * 向指定子应用发送数据
   * @param appName 子应用名称
   * @param data 对象数据
   */
  setData (appName: string, data: Record<PropertyKey, unknown>): void {
    eventCenter.dispatch(formatEventName(appName, true), data)
  }

  /**
   * 清空某个应用的监听函数
   * @param appName 子应用名称
   */
  clearDataListener (appName: string): void {
    eventCenter.off(formatEventName(appName, false))
  }
}

// 子应用的数据通信方法集合
export class EventCenterForMicroApp extends EventCenterForGlobal {
  appName: string
  constructor (appName: string) {
    super()
    this.appName = appName
  }

  /**
   * 监听基座应用发送的数据
   * @param cb 绑定函数
   * @param autoTrigger 在初次绑定监听函数时有缓存数据，是否需要主动触发一次，默认为false
   */
  addDataListener (cb: CallableFunction, autoTrigger?: boolean): void {
    eventCenter.on(formatEventName(this.appName, true), cb, autoTrigger)
  }

  /**
   * 解除监听函数
   * @param cb 绑定函数
   */
  removeDataListener (cb: CallableFunction): void {
    if (typeof cb === 'function') {
      eventCenter.off(formatEventName(this.appName, true), cb)
    }
  }

  /**
   * 主动获取来自基座的数据
   */
  getData (): Record<PropertyKey, unknown> | null {
    return eventCenter.getData(formatEventName(this.appName, true))
  }

  /**
   * 向基座应用发送数据
   * @param data 对象数据
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
   * 清空当前子应用绑定的所有监听函数
   */
  clearDataListener (): void {
    eventCenter.off(formatEventName(this.appName, true))
  }
}
