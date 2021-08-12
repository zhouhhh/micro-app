import type { Func, AppInterface } from '@micro-app/types'
import { appInstanceMap } from '../create_app'
import {
  formatLogMessage,
  CompletionPath,
  getCurrentAppName,
  pureCreateElement,
  setCurrentAppName,
  rawDocument,
} from '../libs/utils'
import scopedCSS from './scoped_css'
import { extractLinkFromHtml, foramtDynamicLink } from './links'
import { extractScriptElement, runScript, runDynamicScript } from './scripts'
import microApp from '../micro_app'

declare global {
  interface Element {
    __MICRO_APP_NAME__: string
    data: any
  }
  interface Node {
    __MICRO_APP_NAME__: string
  }
  interface HTMLStyleElement {
    linkpath: string
  }
}

// save raw methods
const rawSetAttribute = Element.prototype.setAttribute
const rawAppendChild = Node.prototype.appendChild
const rawInsertBefore = Node.prototype.insertBefore
const rawReplaceChild = Node.prototype.replaceChild
const rawRemoveChild = Node.prototype.removeChild
const rawAppend = Element.prototype.append
const rawPrepend = Element.prototype.prepend

const rawCreateElement = Document.prototype.createElement
const rawCreateElementNS = Document.prototype.createElementNS
const rawCreateDocumentFragment = Document.prototype.createDocumentFragment
const rawQuerySelector = Document.prototype.querySelector
const rawQuerySelectorAll = Document.prototype.querySelectorAll
const rawGetElementById = Document.prototype.getElementById
const rawGetElementsByClassName = Document.prototype.getElementsByClassName
const rawGetElementsByTagName = Document.prototype.getElementsByTagName
const rawGetElementsByName = Document.prototype.getElementsByName

// Record element and map element
const dynamicElementInMicroAppMap = new WeakMap<Node, Element | Comment>()

/**
 * Process the new node and format the style, link and script element
 * @param parent parent node
 * @param child new node
 * @param app app
 */
function handleNewNode (parent: Node, child: Node, app: AppInterface): Node {
  if (child instanceof HTMLStyleElement) {
    if (child.hasAttribute('exclude')) {
      const replaceComment = document.createComment('style element with exclude attribute ignored by micro-app')
      dynamicElementInMicroAppMap.set(child, replaceComment)
      return replaceComment
    } else if (app.scopecss) {
      return scopedCSS(child, app.name)
    }
    return child
  } else if (child instanceof HTMLLinkElement) {
    if (child.hasAttribute('exclude')) {
      const linkReplaceComment = document.createComment('link element with exclude attribute ignored by micro-app')
      dynamicElementInMicroAppMap.set(child, linkReplaceComment)
      return linkReplaceComment
    } else if (!app.scopecss) {
      return child
    }

    const { url, info } = extractLinkFromHtml(
      child,
      parent,
      app,
      null,
      true,
    )

    if (url && info) {
      const replaceStyle = pureCreateElement('style')
      replaceStyle.linkpath = url
      foramtDynamicLink(url, info, app, child, replaceStyle)
      dynamicElementInMicroAppMap.set(child, replaceStyle)
      return replaceStyle
    }
    //  else if (replaceComment) {
    //   dynamicElementInMicroAppMap.set(child, replaceComment)
    //   return replaceComment
    // }
    return child
  } else if (child instanceof HTMLScriptElement) {
    const { replaceComment, url, info } = extractScriptElement(
      child,
      parent,
      app,
      true,
    )

    if (url && info) {
      if (info.code) { // inline script
        const replaceElement = runScript(url, info.code, app, info.module, true)
        dynamicElementInMicroAppMap.set(child, replaceElement)
        return replaceElement
      } else { // remote script
        const replaceElement = runDynamicScript(url, info, app, child)
        dynamicElementInMicroAppMap.set(child, replaceElement)
        return replaceElement
      }
    } else {
      dynamicElementInMicroAppMap.set(child, replaceComment)
      return replaceComment
    }
  }

  return child
}

/**
 * Handle the elements inserted into head and body, and execute normally in other cases
 * @param app app
 * @param method raw method
 * @param parent parent node
 * @param targetChild target node
 * @param passiveChild second param of insertBefore and replaceChild
 */
function invokePrototypeMethod (
  app: AppInterface,
  rawMethod: Func,
  parent: Node,
  targetChild: Node,
  passiveChild?: Node | null,
): any {
  /**
   * If passiveChild is not the child node, insertBefore replaceChild will have a problem, at this time, it will be degraded to appendChild
   * E.g: document.head.insertBefore(targetChild, document.head.childNodes[0])
   */
  if (parent instanceof HTMLHeadElement) {
    const microAppHead = app.container!.querySelector('micro-app-head')!
    /**
     * 1. If passivechild exists, it must be insertBefore or replacechild
     * 2. When removeChild, targetChild may not be in microAppHead or head
     */
    if (passiveChild && !microAppHead.contains(passiveChild)) {
      return rawAppendChild.call(microAppHead, targetChild)
    } else if (rawMethod === rawRemoveChild && !microAppHead.contains(targetChild)) {
      if (parent.contains(targetChild)) {
        return rawMethod.call(parent, targetChild)
      }
      return targetChild
    } else if (rawMethod === rawAppend || rawMethod === rawPrepend) {
      return rawMethod.call(microAppHead, targetChild)
    }
    return rawMethod.call(microAppHead, targetChild, passiveChild)
  } else if (parent instanceof HTMLBodyElement) {
    const microAppBody = app.container!.querySelector('micro-app-body')!
    if (passiveChild && !microAppBody.contains(passiveChild)) {
      return rawAppendChild.call(microAppBody, targetChild)
    } else if (rawMethod === rawRemoveChild && !microAppBody.contains(targetChild)) {
      if (parent.contains(targetChild)) {
        return rawMethod.call(parent, targetChild)
      }
      return targetChild
    } else if (rawMethod === rawAppend || rawMethod === rawPrepend) {
      return rawMethod.call(microAppBody, targetChild)
    }
    return rawMethod.call(microAppBody, targetChild, passiveChild)
  } else if (rawMethod === rawAppend || rawMethod === rawPrepend) {
    return rawMethod.call(parent, targetChild)
  }

  return rawMethod.call(parent, targetChild, passiveChild)
}

// Get the map element
function getMappingNode (node: Node): Node {
  return dynamicElementInMicroAppMap.get(node) ?? node
}

/**
 * method of handle new node
 * @param parent parent node
 * @param newChild new node
 * @param passiveChild passive node
 * @param rawMethod raw method
 */
function commonElementHander (
  parent: Node,
  newChild: Node,
  passiveChild: Node | null,
  rawMethod: Func,
) {
  if (newChild?.__MICRO_APP_NAME__) {
    const app = appInstanceMap.get(newChild.__MICRO_APP_NAME__)
    if (app?.container) {
      return invokePrototypeMethod(
        app,
        rawMethod,
        parent,
        handleNewNode(parent, newChild, app),
        passiveChild && getMappingNode(passiveChild),
      )
    } else if (rawMethod === rawAppend || rawMethod === rawPrepend) {
      return rawMethod.call(parent, newChild)
    }
    return rawMethod.call(parent, newChild, passiveChild)
  } else if (rawMethod === rawAppend || rawMethod === rawPrepend) {
    const appName = getCurrentAppName()
    if (!(newChild instanceof Node) && appName) {
      const app = appInstanceMap.get(appName)
      if (app?.container) {
        if (parent instanceof HTMLHeadElement) {
          return rawMethod.call(app.container.querySelector('micro-app-head'), newChild)
        } else if (parent instanceof HTMLBodyElement) {
          return rawMethod.call(app.container.querySelector('micro-app-body'), newChild)
        }
      }
    }
    return rawMethod.call(parent, newChild)
  }

  return rawMethod.call(parent, newChild, passiveChild)
}

/**
 * Rewrite element prototype method
 */
export function patchElementPrototypeMethods (): void {
  patchDocument()

  // Rewrite setAttribute
  Element.prototype.setAttribute = function setAttribute (key: string, value: string): void {
    if (/^micro-app(-\S+)?/i.test(this.tagName) && key === 'data') {
      if (toString.call(value) === '[object Object]') {
        const cloneValue: Record<PropertyKey, unknown> = {}
        Object.getOwnPropertyNames(value).forEach((propertyKey: PropertyKey) => {
          if (!(typeof propertyKey === 'string' && propertyKey.indexOf('__') === 0)) {
            // @ts-ignore
            cloneValue[propertyKey] = value[propertyKey]
          }
        })
        this.data = cloneValue
      } else if (value !== '[object Object]') {
        console.warn(
          formatLogMessage('property data must be an object')
        )
      }
    } else if (
      (
        (key === 'src' && /^(img|iframe|script)$/i.test(this.tagName)) ||
        (key === 'href' && /^link$/i.test(this.tagName))
      ) &&
      this.__MICRO_APP_NAME__ &&
      appInstanceMap.has(this.__MICRO_APP_NAME__)
    ) {
      const app = appInstanceMap.get(this.__MICRO_APP_NAME__)
      rawSetAttribute.call(this, key, CompletionPath(value, app!.url))
    } else {
      rawSetAttribute.call(this, key, value)
    }
  }

  // prototype methods of add element👇
  Node.prototype.appendChild = function appendChild<T extends Node> (newChild: T): T {
    return commonElementHander(this, newChild, null, rawAppendChild)
  }

  Node.prototype.insertBefore = function insertBefore<T extends Node> (newChild: T, refChild: Node | null): T {
    return commonElementHander(this, newChild, refChild, rawInsertBefore)
  }

  Node.prototype.replaceChild = function replaceChild<T extends Node> (newChild: Node, oldChild: T): T {
    return commonElementHander(this, newChild, oldChild, rawReplaceChild)
  }

  Element.prototype.append = function append (...nodes: (Node | string)[]): void {
    let i = 0
    const length = nodes.length
    while (i < length) {
      commonElementHander(this, nodes[i] as Node, null, rawAppend)
      i++
    }
  }

  Element.prototype.prepend = function prepend (...nodes: (Node | string)[]): void {
    let i = nodes.length
    while (i > 0) {
      commonElementHander(this, nodes[i - 1] as Node, null, rawPrepend)
      i--
    }
  }

  // prototype methods of delete element👇
  Node.prototype.removeChild = function removeChild<T extends Node> (oldChild: T): T {
    if (oldChild?.__MICRO_APP_NAME__) {
      const app = appInstanceMap.get(oldChild.__MICRO_APP_NAME__)
      if (app?.container) {
        return invokePrototypeMethod(
          app,
          rawRemoveChild,
          this,
          getMappingNode(oldChild),
        )
      }
      return rawRemoveChild.call(this, oldChild) as T
    }

    return rawRemoveChild.call(this, oldChild) as T
  }
}

/**
 * Mark the newly created element in the micro application
 * @param element new element
 */
function markElement <T extends { __MICRO_APP_NAME__: string }> (element: T): T {
  const appName = getCurrentAppName()
  if (appName) {
    element.__MICRO_APP_NAME__ = appName
  }
  return element
}

// methods of document
function patchDocument () {
  // create element 👇
  Document.prototype.createElement = function createElement (
    tagName: string,
    options?: ElementCreationOptions,
  ): HTMLElement {
    const element = rawCreateElement.call(rawDocument, tagName, options)
    return markElement(element)
  }

  Document.prototype.createElementNS = function createElementNS (
    namespaceURI: string,
    name: string,
    options?: string | ElementCreationOptions,
  ): any {
    const element = rawCreateElementNS.call(rawDocument, namespaceURI, name, options)
    return markElement(element)
  }

  Document.prototype.createDocumentFragment = function createDocumentFragment (): DocumentFragment {
    const element = rawCreateDocumentFragment.call(rawDocument)
    return markElement(element)
  }

  // query element👇
  function querySelector (selectors: string): any {
    const appName = getCurrentAppName()
    if (!appName || selectors === 'head' || selectors === 'body') {
      return rawQuerySelector.call(rawDocument, selectors)
    }
    return appInstanceMap.get(appName)?.container?.querySelector(selectors) ?? null
  }

  function querySelectorAll (selectors: string): any {
    const appName = getCurrentAppName()
    if (!appName || selectors === 'head' || selectors === 'body') {
      return rawQuerySelectorAll.call(rawDocument, selectors)
    }
    return appInstanceMap.get(appName)?.container?.querySelectorAll(selectors) ?? []
  }

  Document.prototype.querySelector = querySelector
  Document.prototype.querySelectorAll = querySelectorAll

  // querySelector does not support the beginning of a number
  Document.prototype.getElementById = function getElementById (key: string): HTMLElement | null {
    const appName = getCurrentAppName()
    if (!appName || /^\d/.test(key)) {
      return rawGetElementById.call(rawDocument, key)
    }
    return querySelector(`#${key}`)
  }

  Document.prototype.getElementsByClassName = function getElementsByClassName (key: string): HTMLCollectionOf<Element> {
    const appName = getCurrentAppName()
    if (!appName || /^\d/.test(key)) {
      return rawGetElementsByClassName.call(rawDocument, key)
    }
    return querySelectorAll(`.${key}`)
  }

  Document.prototype.getElementsByTagName = function getElementsByTagName (key: string): HTMLCollectionOf<Element> {
    const appName = getCurrentAppName()
    if (
      !appName ||
      /^body$/i.test(key) ||
      /^head$/i.test(key) ||
      (!appInstanceMap.get(appName)?.inline && /^script$/i.test(key))
    ) {
      return rawGetElementsByTagName.call(rawDocument, key)
    }
    return querySelectorAll(key)
  }

  Document.prototype.getElementsByName = function getElementsByName (key: string): NodeListOf<HTMLElement> {
    const appName = getCurrentAppName()
    if (!appName || /^\d/.test(key)) {
      return rawGetElementsByName.call(rawDocument, key)
    }
    return querySelectorAll(`[name=${key}]`)
  }
}

function releasePatchDocument (): void {
  Document.prototype.createElement = rawCreateElement
  Document.prototype.createElementNS = rawCreateElementNS
  Document.prototype.createDocumentFragment = rawCreateDocumentFragment
  Document.prototype.querySelector = rawQuerySelector
  Document.prototype.querySelectorAll = rawQuerySelectorAll
  Document.prototype.getElementById = rawGetElementById
  Document.prototype.getElementsByClassName = rawGetElementsByClassName
  Document.prototype.getElementsByTagName = rawGetElementsByTagName
  Document.prototype.getElementsByName = rawGetElementsByName
}

// release patch
export function releasePatches (): void {
  setCurrentAppName(null)
  releasePatchDocument()
  Element.prototype.setAttribute = rawSetAttribute
  Node.prototype.appendChild = rawAppendChild
  Node.prototype.insertBefore = rawInsertBefore
  Node.prototype.replaceChild = rawReplaceChild
  Node.prototype.removeChild = rawRemoveChild
  Element.prototype.append = rawAppend
  Element.prototype.prepend = rawPrepend
}

// Set the style of micro-app-head and micro-app-body
let hasRejectMicroAppStyle = false
export function rejectMicroAppStyle (): void {
  if (!hasRejectMicroAppStyle) {
    hasRejectMicroAppStyle = true
    const style = pureCreateElement('style')
    style.setAttribute('type', 'text/css')
    style.textContent = `\n${microApp.tagName}, micro-app-body { display: block; } \nmicro-app-head { display: none; }`
    rawDocument.head.appendChild(style)
  }
}
