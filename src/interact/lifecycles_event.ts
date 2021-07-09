import microApp from '../micro_app'
import { formatLogMessage } from '../libs/utils'

function eventHandler (event: CustomEvent, element: HTMLElement): void {
  Object.defineProperties(event, {
    currentTarget: {
      get () {
        return element
      }
    },
    target: {
      get () {
        return element
      }
    },
  })
}

/**
 * 发送生命周期事件
 * @param element 容器元素
 * @param appName 应用名称
 * @param lifecycleName 生命周期名称
 * @param error 错误钩子的参数
 */
export default function dispatchLifecyclesEvent (
  element: HTMLElement,
  appName: string,
  lifecycleName: string,
  error?: Error,
): void {
  if (!element) {
    return console.error(
      formatLogMessage(`element does not exist in lifecycle ${lifecycleName}，it seems the app has unmounted`)
    )
  } else if (element instanceof ShadowRoot) {
    element = element.host as HTMLElement
  }

  const detail = Object.assign({
    name: appName,
    container: element,
  }, error && {
    error
  })

  const event = new CustomEvent(lifecycleName, {
    detail,
  })

  eventHandler(event, element)
  // 全局钩子
  // @ts-ignore
  if (typeof microApp.lifeCycles?.[lifecycleName] === 'function') {
    // @ts-ignore
    microApp.lifeCycles[lifecycleName](event)
  }

  element.dispatchEvent(event)
}

/**
 * 向微应用发送卸载事件
 * @param appName 应用名称
 */
export function dispatchUnmountToMicroApp (appName: string): void {
  const event = new CustomEvent(`unmount-${appName}`)
  window.dispatchEvent(event)
}
