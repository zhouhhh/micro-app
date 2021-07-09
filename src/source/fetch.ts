import { isFunction } from '../libs/utils'
import microApp from '../micro_app'

/**
 * 获取静态资源
 * @param url 静态资源地址
 * @param appName 应用名称
 * @param config 配置项
 */
export function fetchSource (url: string, appName: string, options = {}): Promise<string> {
  if (isFunction(microApp.fetch)) {
    return microApp.fetch!(url, options, appName)
  }
  return fetch(url, options).then((res) => {
    return res.text()
  })
}
