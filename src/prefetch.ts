import type { prefetchParamList, prefetchParam } from '@micro-app/types'
import CreateApp, { appInstanceMap } from './create_app'
import { requestIdleCallback, formatURL } from './libs/utils'
import microApp from './micro_app'

function filterPreFetchTarget<T extends prefetchParam> (apps: T[]): T[] {
  const validApps: T[] = []

  if (toString.call(apps) === '[object Array]') {
    apps.forEach((item) => {
      item.url = formatURL(item.url)
      if (
        toString.call(item) === '[object Object]' &&
        (item.name && typeof item.name === 'string') &&
        item.url &&
        !appInstanceMap.has(item.name)
      ) {
        validApps.push(item)
      }
    })
  }

  return validApps
}

/**
 * preFetch([
 *  {
 *    name: string,
 *    url: string,
 *    disableScopecss?: boolean,
 *    disableSandbox?: boolean,
 *    macro?: boolean,
 *  },
 *  ...
 * ])
 * Note:
 *  1: preFetch is asynchronous and is performed only when the browser is idle
 *  2: disableScopecss, disableSandbox, macro must be same with micro-app element, if conflict, the one who executes first shall prevail
 * @param apps micro apps
 */
export default function preFetch (apps: prefetchParamList): void {
  requestIdleCallback(() => {
    if (typeof apps === 'function') apps = apps()

    filterPreFetchTarget(apps).forEach((item) => {
      const app = new CreateApp({
        name: item.name,
        url: item.url,
        scopecss: !(item.disableScopecss ?? microApp.disableScopecss),
        useSandbox: !(item.disableSandbox ?? microApp.disableSandbox),
        macro: item.macro ?? microApp.macro,
      })

      app.isPrefetch = true
      appInstanceMap.set(item.name, app)
    })
  })
}
