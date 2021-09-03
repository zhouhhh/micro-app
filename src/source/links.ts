import type {
  AppInterface,
  sourceLinkInfo,
} from '@micro-app/types'
import { fetchSource } from './fetch'
import {
  CompletionPath,
  promiseStream,
  pureCreateElement,
  defer,
  logError,
  requestIdleCallback,
} from '../libs/utils'
import scopedCSS from './scoped_css'
import {
  dispatchOnLoadEvent,
  dispatchOnErrorEvent,
} from './load_event'
import microApp from '../micro_app'

// Global links, reuse across apps
export const globalLinks = new Map<string, string>()

/**
 * Extract link elements
 * @param link link element
 * @param parent parent element of link
 * @param app app
 * @param microAppHead micro-app-head element
 * @param isDynamic dynamic insert
 */
export function extractLinkFromHtml (
  link: HTMLLinkElement,
  parent: Node,
  app: AppInterface,
  microAppHead: Element | null,
  isDynamic = false,
): any {
  const rel = link.getAttribute('rel')
  let href = link.getAttribute('href')
  let replaceComment: Comment | null = null
  if (rel === 'stylesheet' && href) {
    href = CompletionPath(href, app.url)
    if (!isDynamic) {
      replaceComment = document.createComment(`the link with href=${href} move to micro-app-head as style element`)
      const placeholderComment = document.createComment(`placeholder for link with href=${href}`)
      // all style elements insert into microAppHead
      microAppHead!.appendChild(placeholderComment)
      app.source.links.set(href, {
        code: '',
        placeholder: placeholderComment,
        isGlobal: link.hasAttribute('global'),
      })
    } else {
      return {
        url: href,
        info: {
          code: '',
          isGlobal: link.hasAttribute('global'),
        }
      }
    }
  } else if (href) {
    // preload prefetch modulepreload icon ....
    link.setAttribute('href', CompletionPath(href, app.url))
  }

  if (isDynamic) {
    return { replaceComment }
  } else if (replaceComment) {
    return parent.replaceChild(replaceComment, link)
  }
}

/**
 * Get link remote resources
 * @param wrapElement htmlDom
 * @param app app
 * @param microAppHead micro-app-head
 */
export function fetchLinksFromHtml (
  wrapElement: HTMLElement,
  app: AppInterface,
  microAppHead: Element,
): void {
  const linkEntries: Array<[string, sourceLinkInfo]> = Array.from(app.source.links.entries())
  const fetchLinkPromise: Array<Promise<string>|string> = []
  for (const [url] of linkEntries) {
    const globalLinkCode = globalLinks.get(url)
    globalLinkCode ? fetchLinkPromise.push(globalLinkCode) : fetchLinkPromise.push(fetchSource(url, app.name))
  }

  promiseStream<string>(fetchLinkPromise, (res: {data: string, index: number}) => {
    fetchLinkSuccess(
      linkEntries[res.index][0],
      linkEntries[res.index][1],
      res.data,
      microAppHead,
      app,
    )
  }, (err: {error: Error, index: number}) => {
    logError(err)
  }, () => {
    app.onLoad(wrapElement)
  })
}

/**
 * fetch link succeeded, replace placeholder with style tag
 * @param url resource address
 * @param info resource link info
 * @param data code
 * @param microAppHead micro-app-head
 * @param app app
 */
export function fetchLinkSuccess (
  url: string,
  info: sourceLinkInfo,
  data: string,
  microAppHead: Element,
  app: AppInterface,
): void {
  if (info.isGlobal && !globalLinks.has(url)) {
    globalLinks.set(url, data)
  }

  const styleLink = pureCreateElement('style')
  styleLink.textContent = data
  styleLink.linkpath = url

  microAppHead.replaceChild(scopedCSS(styleLink, app.name), info.placeholder!)

  info.placeholder = null
  info.code = data
}

/**
 * get css from dynamic link
 * @param url link address
 * @param info info
 * @param app app
 * @param originLink origin link element
 * @param replaceStyle style element which replaced origin link
 */
export function foramtDynamicLink (
  url: string,
  info: sourceLinkInfo,
  app: AppInterface,
  originLink: HTMLLinkElement,
  replaceStyle: HTMLStyleElement,
): void {
  if (app.source.links.has(url)) {
    replaceStyle.textContent = app.source.links.get(url)!.code
    scopedCSS(replaceStyle, app.name)
    defer(() => dispatchOnLoadEvent(originLink))
    return
  }

  if (globalLinks.has(url)) {
    const code = globalLinks.get(url)!
    info.code = code
    app.source.links.set(url, info)
    replaceStyle.textContent = code
    scopedCSS(replaceStyle, app.name)
    defer(() => dispatchOnLoadEvent(originLink))
    return
  }

  fetchSource(url, app.name).then((data: string) => {
    info.code = data
    app.source.links.set(url, info)
    if (info.isGlobal) globalLinks.set(url, data)
    replaceStyle.textContent = data
    scopedCSS(replaceStyle, app.name)
    dispatchOnLoadEvent(originLink)
  }).catch((err) => {
    logError(err)
    dispatchOnErrorEvent(originLink)
  })
}

/**
 * In umd mode, source.html needs to clone container before umdHookMount is executed. Since MutationObserver is asynchronous, the style element in container may not be scoped css yet.
 * @param temp source.html
 * @param appName app.name
 */
export function formatHTMLStyleAfterUmdInit (temp: HTMLElement, appName: string): void {
  requestIdleCallback(() => {
    const styleList = Array.from(temp.querySelectorAll('style'))
    for (const styleElement of styleList) {
      if (styleElement.textContent?.indexOf(`${microApp.tagName}[name=${appName}]`) === -1) {
        scopedCSS(styleElement, appName)
      }
    }
  })
}
