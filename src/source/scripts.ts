/* eslint-disable node/no-callback-literal */
import type {
  AppInterface,
  sourceScriptInfo,
  plugins,
  Func,
} from '@micro-app/types'
import { fetchSource } from './fetch'
import {
  CompletionPath,
  promiseStream,
  createNonceSrc,
  pureCreateElement,
  defer,
  logError,
  isUndefined,
  isPlainObject,
  isArray,
  isFunction,
} from '../libs/utils'
import {
  dispatchOnLoadEvent,
  dispatchOnErrorEvent,
} from './load_event'
import microApp from '../micro_app'
import globalEnv from '../libs/global_env'

type moduleCallBack = Func & { moduleCount?: number }

// Global scripts, reuse across apps
export const globalScripts = new Map<string, string>()

/**
 * Extract script elements
 * @param script script element
 * @param parent parent element of script
 * @param app app
 * @param isDynamic dynamic insert
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
    replaceComment = document.createComment('script element with exclude attribute removed by micro-app')
  } else if (
    (script.type && !['text/javascript', 'text/ecmascript', 'application/javascript', 'application/ecmascript', 'module'].includes(script.type)) ||
    script.hasAttribute('ignore')
  ) {
    return null
  } else if (
    (globalEnv.supportModuleScript && script.noModule) ||
    (!globalEnv.supportModuleScript && script.type === 'module')
  ) {
    replaceComment = document.createComment(`${script.noModule ? 'noModule' : 'module'} script ignored by micro-app`)
  } else if (src) { // remote script
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
  } else if (script.textContent) { // inline script
    const nonceStr: string = createNonceSrc()
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
    replaceComment = document.createComment('script element removed by micro-app')
  }

  if (isDynamic) {
    return { replaceComment }
  } else {
    return parent.replaceChild(replaceComment, script)
  }
}

/**
 *  Get remote resources of script
 * @param wrapElement htmlDom
 * @param app app
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
      logError(err, app.name)
    }, () => {
      app.onLoad(wrapElement)
    })
  } else {
    app.onLoad(wrapElement)
  }
}

/**
 * fetch js succeeded, record the code value
 * @param url script address
 * @param info resource script info
 * @param data code
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
 * Execute js in the mount lifecycle
 * @param scriptList script list
 * @param app app
 * @param initedHook callback for umd mode
 */
export function execScripts (
  scriptList: Map<string, sourceScriptInfo>,
  app: AppInterface,
  initedHook: moduleCallBack,
): void {
  const scriptListEntries: Array<[string, sourceScriptInfo]> = Array.from(scriptList.entries())
  const deferScriptPromise: Array<Promise<string>|string> = []
  const deferScriptInfo: Array<[string, sourceScriptInfo]> = []
  for (const [url, info] of scriptListEntries) {
    if (!info.isDynamic) {
      if (info.defer || info.async) {
        if (info.isExternal && !info.code) {
          deferScriptPromise.push(fetchSource(url, app.name))
        } else {
          deferScriptPromise.push(info.code)
        }
        deferScriptInfo.push([url, info])

        if (info.module) initedHook.moduleCount = initedHook.moduleCount ? ++initedHook.moduleCount : 1
      } else {
        runScript(url, info.code, app, info.module, false)
      }
    }
  }

  if (deferScriptPromise.length) {
    Promise.all(deferScriptPromise).then((res: string[]) => {
      res.forEach((code, index) => {
        const [url, info] = deferScriptInfo[index]
        runScript(url, info.code = info.code || code, app, info.module, false, initedHook)
      })
      initedHook(isUndefined(initedHook.moduleCount))
    }).catch((err) => {
      logError(err, app.name)
      initedHook(true)
    })
  } else {
    initedHook(true)
  }
}

/**
 * run code
 * @param url script address
 * @param code js code
 * @param app app
 * @param module type='module' of script
 * @param isDynamic dynamically created script
 * @param callback callback of module script
 */
export function runScript (
  url: string,
  code: string,
  app: AppInterface,
  module: boolean,
  isDynamic: boolean,
  callback?: moduleCallBack,
): any {
  try {
    code = bindScope(url, code, app, module)
    if (app.inline || module) {
      const scriptElement = pureCreateElement('script')
      setInlinScriptContent(url, code, module, scriptElement, callback)
      if (isDynamic) return scriptElement
      app.container?.querySelector('micro-app-body')!.appendChild(scriptElement)
    } else {
      Function(code)()
      if (isDynamic) return document.createComment('dynamic script extract by micro-app')
    }
  } catch (e) {
    console.error(`[micro-app from runScript] app ${app.name}: `, e)
  }
}

/**
 * Get dynamically created remote script
 * @param url script address
 * @param info info
 * @param app app
 * @param originScript origin script element
 */
export function runDynamicRemoteScript (
  url: string,
  info: sourceScriptInfo,
  app: AppInterface,
  originScript: HTMLScriptElement,
): HTMLScriptElement | Comment {
  const dispatchScriptOnLoadEvent = () => dispatchOnLoadEvent(originScript)

  if (app.source.scripts.has(url)) {
    const existInfo: sourceScriptInfo = app.source.scripts.get(url)!
    if (!info.module) defer(dispatchScriptOnLoadEvent)
    return runScript(url, existInfo.code, app, info.module, true, dispatchScriptOnLoadEvent)
  }

  if (globalScripts.has(url)) {
    const code = globalScripts.get(url)!
    info.code = code
    app.source.scripts.set(url, info)
    if (!info.module) defer(dispatchScriptOnLoadEvent)
    return runScript(url, code, app, info.module, true, dispatchScriptOnLoadEvent)
  }

  let replaceElement: Comment | HTMLScriptElement
  if (app.inline || info.module) {
    replaceElement = pureCreateElement('script')
  } else {
    replaceElement = document.createComment(`dynamic script with src='${url}' extract by micro-app`)
  }

  fetchSource(url, app.name).then((code: string) => {
    info.code = code
    app.source.scripts.set(url, info)
    if (info.isGlobal) globalScripts.set(url, code)
    try {
      code = bindScope(url, code, app, info.module)
      if (app.inline || info.module) {
        setInlinScriptContent(url, code, info.module, replaceElement as HTMLScriptElement, dispatchScriptOnLoadEvent)
      } else {
        Function(code)()
      }
    } catch (e) {
      console.error(`[micro-app from runDynamicScript] app ${app.name}: `, e, url)
    }
    if (!info.module) dispatchOnLoadEvent(originScript)
  }).catch((err) => {
    logError(err, app.name)
    dispatchOnErrorEvent(originScript)
  })

  return replaceElement
}

/**
 * common handle for inline script
 * @param url script address
 * @param code js code
 * @param module type='module' of script
 * @param scriptElement target script element
 * @param callback callback of module script
 */
function setInlinScriptContent (
  url: string,
  code: string,
  module: boolean,
  scriptElement: HTMLScriptElement,
  callback?: moduleCallBack,
): void {
  if (module) {
    // module script is async, transform it to a blob for subsequent operations
    const blob = new Blob([code], { type: 'text/javascript;charset=utf-8' })
    scriptElement.src = URL.createObjectURL(blob)
    scriptElement.setAttribute('type', 'module')
    if (!url.startsWith('inline-')) {
      scriptElement.setAttribute('originSrc', url)
    }
    if (callback) {
      callback.moduleCount && callback.moduleCount--
      scriptElement.onload = callback.bind(scriptElement, callback.moduleCount === 0)
    }
  } else {
    scriptElement.textContent = code
  }
}

/**
 * bind js scope
 * @param url script address
 * @param code code
 * @param app app
 * @param module type='module' of script
 */
function bindScope (
  url: string,
  code: string,
  app: AppInterface,
  module: boolean,
): string {
  if (isPlainObject(microApp.plugins)) {
    code = usePlugins(url, code, app.name, microApp.plugins!)
  }
  if (app.sandBox && !module) {
    globalEnv.rawWindow.__MICRO_APP_PROXY_WINDOW__ = app.sandBox.proxyWindow
    return `;(function(window, self){with(window){;${code}\n}}).call(window.__MICRO_APP_PROXY_WINDOW__, window.__MICRO_APP_PROXY_WINDOW__, window.__MICRO_APP_PROXY_WINDOW__);`
  }
  return code
}

/**
 * Call the plugin to process the file
 * @param url script address
 * @param code code
 * @param appName app name
 * @param plugins plugin list
 */
function usePlugins (url: string, code: string, appName: string, plugins: plugins): string {
  if (isArray(plugins.global)) {
    for (const plugin of plugins.global) {
      if (isPlainObject(plugin) && isFunction(plugin.loader)) {
        code = plugin.loader!(code, url, plugin.options)
      }
    }
  }

  if (isArray(plugins.modules?.[appName])) {
    for (const plugin of plugins.modules![appName]) {
      if (isPlainObject(plugin) && isFunction(plugin.loader)) {
        code = plugin.loader!(code, url, plugin.options)
      }
    }
  }

  return code
}
