import type {
  AppInterface,
  sourceScriptInfo,
  plugins,
} from '@micro-app/types'
import { fetchSource } from './fetch'
import {
  CompletionPath,
  promiseStream,
  isSupportModuleScript,
  createNonceStr,
  pureCreateElement,
  rawWindow,
  defer,
} from '../libs/utils'
import {
  dispatchOnLoadEvent,
  dispatchOnErrorEvent,
} from './load_event'
import microApp from '../micro_app'

// 全局script，跨应用复用
export const globalScripts = new Map<string, string>()
const supportModuleScript = isSupportModuleScript()

/**
 * 提取script标签
 * @param script script标签
 * @param parent 父级容器
 * @param app 实例
 * @param isDynamic 是否动态插入
 */
export function extractScriptElement (
  script: HTMLScriptElement,
  parent: Node,
  app: AppInterface,
  isDynamic = false,
): any {
  let replaceComment: Comment | null = null
  let src: string | null = script.getAttribute('src')
  if (script.hasAttribute('exclude')) {
    replaceComment = document.createComment('script element with exclude attribute ignored by micro-app')
  } else if (
    (supportModuleScript && script.noModule) ||
    (!supportModuleScript && script.type === 'module')
  ) {
    replaceComment = document.createComment(`${script.noModule ? 'noModule' : 'module'} script ignored by micro-app`)
  } else if (src) { // 远程script
    src = CompletionPath(src, app.url)
    const info = {
      code: '',
      isExternal: true,
      isDynamic: isDynamic,
      async: script.hasAttribute('async'),
      defer: script.defer || script.type === 'module',
      module: script.type === 'module',
      isGlobal: script.hasAttribute('global'),
    }
    if (!isDynamic) {
      app.source.scripts.set(src, info)
      replaceComment = document.createComment(`script with src='${src}' extract by micro-app`)
    } else {
      return { url: src, info }
    }
  } else if (script.textContent) { // 内联script
    const nonceStr: string = createNonceStr()
    const info = {
      code: script.textContent,
      isExternal: false,
      isDynamic: isDynamic,
      async: false,
      defer: script.type === 'module',
      module: script.type === 'module',
    }
    if (!isDynamic) {
      app.source.scripts.set(nonceStr, info)
      replaceComment = document.createComment('inline script extract by micro-app')
    } else {
      return { url: nonceStr, info }
    }
  } else {
    replaceComment = document.createComment('script ignored by micro-app')
  }

  if (isDynamic) {
    return { replaceComment }
  } else {
    return parent.replaceChild(replaceComment, script)
  }
}

/**
 * 获取script远程资源
 * @param wrapElement 容器
 * @param app 实例
 */
export function fetchScriptsFromHtml (
  wrapElement: HTMLElement,
  app: AppInterface,
): void {
  const scriptEntries: Array<[string, sourceScriptInfo]> = Array.from(app.source.scripts.entries())
  const fetchScriptPromise: Promise<string>[] = []
  const fetchScriptPromiseInfo: Array<[string, sourceScriptInfo]> = []
  for (const [url, info] of scriptEntries) {
    if (info.isExternal) {
      const globalScriptText = globalScripts.get(url)
      if (globalScriptText) {
        info.code = globalScriptText
      } else if (!info.defer && !info.async) {
        fetchScriptPromise.push(fetchSource(url, app.name))
        fetchScriptPromiseInfo.push([url, info])
      }
    }
  }

  if (fetchScriptPromise.length) {
    promiseStream<string>(fetchScriptPromise, (res: {data: string, index: number}) => {
      fetchScriptSuccess(
        fetchScriptPromiseInfo[res.index][0],
        fetchScriptPromiseInfo[res.index][1],
        res.data,
      )
    }, (err: {error: Error, index: number}) => {
      console.error('[micro-app]', err)
    }, () => {
      app.onLoad(wrapElement)
    })
  } else {
    app.onLoad(wrapElement)
  }
}

/**
 * 请求js成功，记录code值
 * @param url script地址
 * @param info 详情
 * @param data 资源内容
 */
export function fetchScriptSuccess (
  url: string,
  info: sourceScriptInfo,
  data: string,
): void {
  if (info.isGlobal && !globalScripts.has(url)) {
    globalScripts.set(url, data)
  }

  info.code = data
}

/**
 * mount生命周期中执行js
 * @param scriptList html中的script列表
 * @param app 应用实例
 */
export function execScripts (scriptList: Map<string, sourceScriptInfo>, app: AppInterface): void {
  const scriptListEntries: Array<[string, sourceScriptInfo]> = Array.from(scriptList.entries())
  const deferScriptPromise: Array<Promise<string>|string> = []
  const deferScriptInfo: Array<[string, sourceScriptInfo]> = []
  for (const [url, info] of scriptListEntries) {
    if (!info.isDynamic) {
      if (info.defer || info.async) {
        if (info.isExternal) {
          deferScriptPromise.push(fetchSource(url, app.name))
        } else {
          deferScriptPromise.push(info.code)
        }
        deferScriptInfo.push([url, info])
      } else {
        runScript(url, info.code, app, info.module, false)
      }
    }
  }

  if (deferScriptPromise.length) {
    Promise.all(deferScriptPromise).then((res: string[]) => {
      res.forEach((code, index) => {
        runScript(deferScriptInfo[index][0], code, app, deferScriptInfo[index][1].module, false)
      })
    }).catch((err) => {
      console.error('[micro-app]', err)
    })
  }
}

/**
 * 获取动态创建的远程js
 * @param url js地址
 * @param info info
 * @param app 应用
 * @param originScript 原script标签
 */
export function runDynamicScript (
  url: string,
  info: sourceScriptInfo,
  app: AppInterface,
  originScript: HTMLScriptElement,
): HTMLScriptElement | Comment {
  if (app.source.scripts.has(url)) {
    const existInfo: sourceScriptInfo = app.source.scripts.get(url)!
    defer(() => dispatchOnLoadEvent(originScript))
    return runScript(url, existInfo.code, app, info.module, true)
  }

  if (globalScripts.has(url)) {
    const code = globalScripts.get(url)!
    info.code = code
    app.source.scripts.set(url, info)
    defer(() => dispatchOnLoadEvent(originScript))
    return runScript(url, code, app, info.module, true)
  }

  let replaceElement: Comment | HTMLScriptElement
  if (app.inline) {
    replaceElement = pureCreateElement('script')
  } else {
    replaceElement = document.createComment(`dynamic script with src='${url}' extract by micro-app`)
  }

  fetchSource(url, app.name).then((data: string) => {
    info.code = data
    app.source.scripts.set(url, info)
    if (info.isGlobal) globalScripts.set(url, data)
    try {
      data = bindScope(url, data, app)
      if (app.inline) {
        if (info.module) (replaceElement as HTMLScriptElement).setAttribute('type', 'module')
        replaceElement.textContent = data
      } else {
        (0, eval)(data)
      }
    } catch (e) {
      console.error('[micro-app from runDynamicScript]', e, url)
    }
    dispatchOnLoadEvent(originScript)
  }).catch((err) => {
    console.error('[micro-app]', err)
    dispatchOnErrorEvent(originScript)
  })

  return replaceElement
}

/**
 * 运行代码
 * @param url 文件地址
 * @param code js代码
 * @param app 应用实例
 * @param module 是否是module标签
 * @param isDynamic 动态创建的script标签
 */
export function runScript (
  url: string,
  code: string,
  app: AppInterface,
  module: boolean,
  isDynamic: boolean,
): any {
  try {
    code = bindScope(url, code, app)
    if (app.inline) {
      const script = pureCreateElement('script')
      if (module) script.setAttribute('type', 'module')
      script.textContent = code
      if (isDynamic) return script
      app.container?.querySelector('micro-app-body')!.appendChild(script)
    } else {
      (0, eval)(code)
      if (isDynamic) return document.createComment('dynamic script extract by micro-app')
    }
  } catch (e) {
    console.error('[micro-app from runScript]', e)
  }
}

/**
 * 绑定js作用域
 * @param url js地址
 * @param code 代码内容
 * @param app 应用实例
 * @returns string
 */
function bindScope (
  url: string,
  code: string,
  app: AppInterface,
): string {
  if (app.sandBox) {
    if (typeof microApp.plugins === 'object') {
      code = usePlugins(url, code, app.name, microApp.plugins)
    }
    rawWindow.proxyWindow = app.sandBox.proxyWindow
    return `;(function(window, self){with(window){;${code}\n}}).call(window.proxyWindow, window.proxyWindow, window.proxyWindow);`
  }
  return code
}

/**
 * 调用插件处理文件
 * @param url js地址
 * @param code 代码
 * @param appName 应用名称
 * @param plugins 插件列表
 * @returns string
 */
function usePlugins (url: string, code: string, appName: string, plugins: plugins): string {
  if (toString.call(plugins.global) === '[object Array]') {
    for (const plugin of plugins.global!) {
      if (typeof plugin === 'object' && typeof plugin.loader === 'function') {
        code = plugin.loader(code, url, plugin.options)
      }
    }
  }

  if (toString.call(plugins.modules?.[appName]) === '[object Array]') {
    for (const plugin of plugins.modules![appName]) {
      if (typeof plugin === 'object' && typeof plugin.loader === 'function') {
        code = plugin.loader(code, url, plugin.options)
      }
    }
  }

  return code
}
