import type { prefetchParamList, prefetchParam, globalAssetsType } from '@micro-app/types'
import CreateApp, { appInstanceMap } from './create_app'
import {
  requestIdleCallback,
  formatAppURL,
  formatAppName,
  promiseStream,
  logError,
  isBrowser,
  isArray,
  isPlainObject,
  isString,
  isFunction,
} from './libs/utils'
import { fetchSource } from './source/fetch'
import { globalLinks } from './source/links'
import { globalScripts } from './source/scripts'
import microApp from './micro_app'

function filterPreFetchTarget<T extends prefetchParam> (apps: T[]): T[] {
  const validApps: T[] = []

  if (isArray(apps)) {
    apps.forEach((item) => {
      if (isPlainObject(item)) {
        item.name = formatAppName(item.name)
        item.url = formatAppURL(item.url, item.name)
        if (item.name && item.url && !appInstanceMap.has(item.name)) {
          validApps.push(item)
        }
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
 *  },
 *  ...
 * ])
 * Note:
 *  1: preFetch is asynchronous and is performed only when the browser is idle
 *  2: disableScopecss, disableSandbox must be same with micro-app element, if conflict, the one who executes first shall prevail
 * @param apps micro apps
 */
export default function preFetch (apps: prefetchParamList): void {
  if (!isBrowser) {
    return logError('preFetch is only supported in browser environment')
  }
  requestIdleCallback(() => {
    isFunction(apps) && (apps = (apps as Function)())

    filterPreFetchTarget(apps as prefetchParam[]).forEach((item) => {
      const app = new CreateApp({
        name: item.name,
        url: item.url,
        scopecss: !(item.disableScopecss ?? microApp.disableScopecss),
        useSandbox: !(item.disableSandbox ?? microApp.disableSandbox),
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
  if (isPlainObject(assets)) {
    requestIdleCallback(() => {
      fetchGlobalResources(assets.js, 'js', globalScripts)
      fetchGlobalResources(assets.css, 'css', globalLinks)
    })
  }
}

function fetchGlobalResources (resources:string[] | undefined, suffix:string, cache:Map<string, string>) {
  if (!isArray(resources)) {
    return
  }

  const effectiveResource = resources!.filter((path) => isString(path) && path.includes(`.${suffix}`) && !cache.has(path))

  const fetchResourcePromise = effectiveResource.map((path) => fetchSource(path))

  // fetch resource with stream
  promiseStream<string>(fetchResourcePromise, (res: {data: string, index: number}) => {
    const path = effectiveResource[res.index]
    if (!cache.has(path)) {
      cache.set(path, res.data)
    }
  }, (err: {error: Error, index: number}) => {
    logError(err)
  })
}
