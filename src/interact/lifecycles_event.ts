import microApp from '../micro_app'
import { logError, isFunction, removeDomScope, getRootContainer } from '../libs/utils'

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
 * dispatch lifeCycles event to base app
 * created, beforemount, mounted, unmount, error
 * @param element container
 * @param appName app.name
 * @param lifecycleName lifeCycle name
 * @param error param from error hook
 */
export default function dispatchLifecyclesEvent (
  element: HTMLElement | ShadowRoot,
  appName: string,
  lifecycleName: string,
  error?: Error,
): void {
  if (!element) {
    return logError(`element does not exist in lifecycle ${lifecycleName}`, appName)
  }

  element = getRootContainer(element)

  // clear dom scope before dispatch lifeCycles event to base app, especially mounted & unmount
  removeDomScope()

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
  // global hooks
  // @ts-ignore
  if (isFunction(microApp.lifeCycles?.[lifecycleName])) {
    // @ts-ignore
    microApp.lifeCycles[lifecycleName](event)
  }

  element.dispatchEvent(event)
}

/**
 * Dispatch unmount event to micro app
 * @param appName app.name
 */
export function dispatchUnmountToMicroApp (appName: string): void {
  const event = new CustomEvent(`unmount-${appName}`)
  window.dispatchEvent(event)
}
