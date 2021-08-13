import type { prefetchParamList, prefetchParam, globalAssetsType } from '@micro-app/types'
import CreateApp, { appInstanceMap } from './create_app'
import { requestIdleCallback, formatURL, promiseStream } from './libs/utils'
import { fetchSource } from './source/fetch'
import { globalLinks } from './source/links'
import { globalScripts } from './source/scripts'
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

/**
 * load global assets into cache
 * @param assets global assets of js, css
 */
export function getGlobalAssets (assets: globalAssetsType): void {
  if (toString.call(assets) === '[object Object]') {
    requestIdleCallback(() => {
      if (toString.call(assets.js) === '[object Array]') {
        const effectiveJs = assets.js!.filter((path) => typeof path === 'string' && path.includes('.js') && !globalScripts.has(path))

        const fetchJSPromise: Array<Promise<string>> = []
        effectiveJs.forEach((path) => {
          fetchJSPromise.push(fetchSource(path))
        })

        // fetch js with stream
        promiseStream<string>(fetchJSPromise, (res: {data: string, index: number}) => {
          const path = effectiveJs[res.index]
          if (!globalScripts.has(path)) {
            globalScripts.set(path, res.data)
          }
        }, (err: {error: Error, index: number}) => {
          console.error('[micro-app]', err)
        })
      }

      if (toString.call(assets.css) === '[object Array]') {
        const effectiveCss = assets.css!.filter((path) => typeof path === 'string' && path.includes('.css') && !globalLinks.has(path))

        const fetchCssPromise: Array<Promise<string>> = []
        effectiveCss.forEach((path) => {
          fetchCssPromise.push(fetchSource(path))
        })

        // fetch css with stream
        promiseStream<string>(fetchCssPromise, (res: {data: string, index: number}) => {
          const path = effectiveCss[res.index]
          if (!globalLinks.has(path)) {
            globalLinks.set(path, res.data)
          }
        }, (err: {error: Error, index: number}) => {
          console.error('[micro-app]', err)
        })
      }
    })
  }
}
