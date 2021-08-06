import type { AppInterface } from '@micro-app/types'
import { fetchSource } from './fetch'
import { formatLogMessage, CompletionPath, pureCreateElement } from '../libs/utils'
import { extractLinkFromHtml, fetchLinksFromHtml } from './links'
import { extractScriptElement, fetchScriptsFromHtml } from './scripts'
import scopedCSS from './scoped_css'

/**
 * 将html字符串转换为dom
 * @param str string dom
 */
function getWrapElement (str: string): HTMLElement {
  const wrapDiv = pureCreateElement('div')

  wrapDiv.innerHTML = str

  return wrapDiv
}

/**
 * 递归处理每一个子元素
 * @param parent 父元素
 * @param app 应用实例
 * @param microAppHead micro-app-head标签
 */
function flatChildren (
  parent: HTMLElement,
  app: AppInterface,
  microAppHead: Element,
): void {
  const children = Array.from(parent.children)

  children.length && children.forEach((child) => {
    flatChildren(child as HTMLElement, app, microAppHead)
  })

  for (const dom of children) {
    if (dom instanceof HTMLLinkElement) {
      if (dom.hasAttribute('exclude')) {
        parent.replaceChild(document.createComment('link element with exclude attribute ignored by micro-app'), dom)
      } else if (app.scopecss) {
        extractLinkFromHtml(dom, parent, app, microAppHead)
      } else if (dom.hasAttribute('href')) {
        dom.setAttribute('href', CompletionPath(dom.getAttribute('href')!, app.url))
      }
    } else if (dom instanceof HTMLStyleElement) {
      if (dom.hasAttribute('exclude')) {
        parent.replaceChild(document.createComment('style element with exclude attribute ignored by micro-app'), dom)
      } else if (app.scopecss) {
        microAppHead.appendChild(scopedCSS(dom, app.name))
      }
    } else if (dom instanceof HTMLScriptElement) {
      extractScriptElement(dom, parent, app)
    } else if (dom instanceof HTMLMetaElement || dom instanceof HTMLTitleElement) {
      parent.removeChild(dom)
    } else {
      if (/^(img|iframe)$/i.test(dom.tagName) && dom.hasAttribute('src')) {
        dom.setAttribute('src', CompletionPath(dom.getAttribute('src')!, app.url))
      }
    }
  }
}

/**
 * 提取link和script，绑定style作用域
 * @param htmlStr html字符串
 * @param app 应用实例
 */
function extractSourceDom (htmlStr: string, app: AppInterface) {
  const wrapElement = getWrapElement(htmlStr)
  const microAppHead = wrapElement.querySelector('micro-app-head')
  const microAppBody = wrapElement.querySelector('micro-app-body')

  if (!microAppHead || !microAppBody) {
    const msg = `element ${microAppHead ? 'body' : 'head'} is missing`
    app.onerror(new Error(msg))
    return console.error(
      formatLogMessage(msg)
    )
  }

  flatChildren(wrapElement, app, microAppHead)

  if (app.source.links.size) {
    fetchLinksFromHtml(wrapElement, app, microAppHead)
  } else {
    app.onLoad(wrapElement)
  }

  if (app.source.scripts.size) {
    fetchScriptsFromHtml(wrapElement, app)
  } else {
    app.onLoad(wrapElement)
  }
}

/**
 * 提取并格式化html
 * @param app 应用实例
 */
export default function extractHtml (app: AppInterface): void {
  fetchSource(app.url, app.name, { cache: 'no-cache' }).then((htmlStr: string) => {
    if (!htmlStr) {
      const msg = 'html is empty, please check in detail'
      app.onerror(new Error(msg))
      return console.error(formatLogMessage(msg))
    }
    htmlStr = htmlStr
      .replace(/<head[^>]*>[\s\S]*?<\/head>/i, (match) => {
        return match
          .replace(/<head/i, '<micro-app-head')
          .replace(/<\/head>/i, '</micro-app-head>')
      })
      .replace(/<body[^>]*>[\s\S]*?<\/body>/i, (match) => {
        return match
          .replace(/<body/i, '<micro-app-body')
          .replace(/<\/body>/i, '</micro-app-body>')
      })

    extractSourceDom(htmlStr, app)
  }).catch((e) => {
    console.error(
      formatLogMessage(`Failed to fetch data from ${app.url}, micro-app stop rendering`),
      e
    )
    app.onLoadError(e)
  })
}
