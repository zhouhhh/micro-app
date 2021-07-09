/* eslint-disable no-new-func */
import type { Func } from '@micro-app/types'

type RequestIdleCallbackOptions = {
  timeout: number
}

type RequestIdleCallbackInfo = {
  readonly didTimeout: boolean
  timeRemaining: () => number
}

declare global {
  interface Window {
    requestIdleCallback (
      callback: (info: RequestIdleCallbackInfo) => void,
      opts?: RequestIdleCallbackOptions,
    ): number
    _babelPolyfill: boolean
    proxyWindow: WindowProxy
    __MICRO_APP_ENVIRONMENT__: boolean
  }
}

export const rawWindow = new Function('return window')()
export const rawDocument = new Function('return document')()
export const version = '__VERSION__'

/**
 * 格式化log信息
 * @param msg log信息
 */
export function formatLogMessage (msg: string): string {
  if (typeof msg === 'string') {
    return `[micro-app] ${msg}`
  }

  return msg
}

/**
 * 延迟执行
 * @param fn 回调函数
 * @param args 入参
 */
export function defer (fn: Func, ...args: any[]): void {
  Promise.resolve().then(fn.bind(null, ...args))
}

/**
 * 格式化URL地址
 * @param url 地址
 */
export function formatURL (url: string | null): string {
  if (typeof url !== 'string' || !url) return ''

  try {
    const { origin, pathname } = new URL(
      url.startsWith('//') ? `${location.protocol}${url}` : url
    )
    // 如果以.html结尾，则不需要补全 /
    if (/\.html$/.test(pathname)) {
      return `${origin}${pathname}`
    }
    const fullPath = `${origin}${pathname}/`.replace(/\/\/$/, '/')
    return /^https?:\/\//.test(fullPath) ? fullPath : ''
  } catch (e) {
    console.error('[micro-app]', e)
    return ''
  }
}

/**
 * 获取的地址的有效域名，如 https://xxx/xx/xx.html 格式化为 https://xxx/xx/
 * @param url app.url
 */
export function getEffectivePath (url: string): string {
  if (/\.html$/.test(url)) {
    const pathArr = url.split('/')
    pathArr.pop()
    return pathArr.join('/') + '/'
  }

  return url
}

/**
 * 补全静态资源相对地址
 * @param path 静态资源地址
 * @param baseURI 基础地址 -- app.url
 */
export function CompletionPath (path: string, baseURI: string): string {
  if (/^((((ht|f)tps?)|file):)?\/\//.test(path)) return path

  return new URL(path, getEffectivePath(baseURI)).toString()
}

/**
 * 获取link资源所在文件夹，用于补全css中的相对地址
 * @param linkpath link地址
 */
export function getLinkFileDir (linkpath: string): string {
  const pathArr = linkpath.split('/')
  pathArr.pop()
  return pathArr.join('/') + '/'
}

/**
 * promise流
 * @param promiseList promise数组，必传
 * @param successsCb 成功回调，必传
 * @param errorCb 失败回调，必传
 * @param finallyCb 结束回调，必传
 */
export function promiseStream <T> (
  promiseList: Array<Promise<T> | T>,
  successsCb: CallableFunction,
  errorCb: CallableFunction,
  finallyCb: CallableFunction,
): void {
  let finishedNum = 0

  function isFinished () {
    if (++finishedNum === promiseList.length) finallyCb()
  }

  promiseList.forEach((p, i) => {
    if (toString.call(p) === '[object Promise]') {
      (p as Promise<T>).then((res: T) => {
        successsCb({
          data: res,
          index: i,
        })
        isFinished()
      }).catch((err: Error) => {
        errorCb({
          error: err,
          index: i,
        })
        isFinished()
      })
    } else {
      successsCb({
        data: p,
        index: i,
      })
      isFinished()
    }
  })
}

// 检测浏览器是否支持module script
export function isSupportModuleScript (): boolean {
  const s = document.createElement('script')
  return 'noModule' in s
}

// 创建随机symbol字符串
export function createNonceStr (): string {
  return Math.random().toString(36).substr(2, 15)
}

// 数组去重
export function unique (array: any[]): any[] {
  return array.filter(function (this: Record<PropertyKey, unknown>, item) {
    return item in this ? false : (this[item] = true)
  }, Object.create(null))
}

// requestIdleCallback polyfill
export const requestIdleCallback = window.requestIdleCallback ||
  function (fn: CallableFunction) {
    const lastTime = Date.now()
    return setTimeout(function () {
      fn({
        didTimeout: false,
        timeRemaining () {
          return Math.max(0, 50 - (Date.now() - lastTime))
        },
      })
    }, 1)
  }

/**
 * 记录当前正在运行的appName
 */
let currentMicroAppName: string | null = null
export function setCurrentAppName (appName: string | null): void {
  currentMicroAppName = appName
}

// 获取当前运行的应用名称
export function getCurrentAppName (): string | null {
  return currentMicroAppName
}

// 清除appName绑定
export function removeDomScope (): void {
  setCurrentAppName(null)
}

// 是否是safari浏览器
export function isSafari (): boolean {
  return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
}

// 是否是函数类型
export function isFunction (target: unknown): boolean {
  return typeof target === 'function'
}

/**
 * 创建纯净的无绑定的元素
 */
export function pureCreateElement<K extends keyof HTMLElementTagNameMap> (tagName: K, options?: ElementCreationOptions): HTMLElementTagNameMap[K] {
  const element = rawDocument.createElement(tagName, options)
  if (element.__MICRO_APP_NAME__) delete element.__MICRO_APP_NAME__
  return element
}
