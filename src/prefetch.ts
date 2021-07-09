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
 * 预加载
 * preFetch([
 *  {
 *    name: string,
 *    url: string,
 *    disableScopecss: boolean,
 *    disableSandbox: boolean,
 *    macro: boolean,
 *    shadowDOM: boolean,
 *  },
 *  ...
 * ])
 * 注意：
 *  1、预加载是异步的，在浏览器空闲时才会执行
 *  2、预加载的 disableScopecss、disableSandbox、macro、shadowDOM 和micro-app组件要保持一致，如果冲突，谁先执行则以谁为准
 * @param apps 应用列表
 */
export default function preFetch (apps: prefetchParamList): void {
  requestIdleCallback(() => {
    if (typeof apps === 'function') apps = apps()

    filterPreFetchTarget(apps).forEach((item) => {
      const app = new CreateApp({
        name: item.name,
        url: item.url,
        scopecss: !(
          (item.disableScopecss ?? microApp.disableScopecss) ||
          (item.shadowDOM ?? microApp.shadowDOM)
        ),
        useSandbox: !(item.disableSandbox ?? microApp.disableSandbox),
        macro: item.macro ?? microApp.macro,
      })

      app.isPrefetch = true
      appInstanceMap.set(item.name, app)
    })
  })
}
