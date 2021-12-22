import globalEnv from '../libs/global_env'
import {
  createElement,
  createElementNS,
  createDocumentFragment,
  querySelector,
  querySelectorAll,
  getElementById,
  getElementsByClassName,
  getElementsByTagName,
  getElementsByName,
} from '../source/patch'

// import { appInstanceMap } from '../create_app'
// import {
//   isUniqueElement,
//   isInvalidQuerySelectorKey,
// } from '../libs/utils'

// vite子应用循环潜逃如何处理？？？
if (!window.__MICRO_APP_ENVIRONMENT__) {
  Object.defineProperty(Element.prototype, 'ownerDocument', {
    get () {
      if (globalEnv.rawWindow.__MICRO_APP_PROXY_WINDOW__) {
        return globalEnv.rawWindow.__MICRO_APP_PROXY_WINDOW__.document
      }
      return globalEnv.rawDocument
    },
    set () {
      return true
    },
    configurable: false,
  })
}

// function querySelector (this: microDocumentType, selectors: string): any {
//   if (!selectors || isUniqueElement(selectors)) {
//     return globalEnv.rawQuerySelector.call(globalEnv.rawDocument, selectors)
//   }
//   return appInstanceMap.get(this.__MICRO_APP_NAME__)?.container?.querySelector(selectors) ?? null
// }

// function querySelectorAll (this: microDocumentType, selectors: string): any {
//   if (!selectors || isUniqueElement(selectors)) {
//     return globalEnv.rawQuerySelectorAll.call(globalEnv.rawDocument, selectors)
//   }
//   return appInstanceMap.get(this.__MICRO_APP_NAME__)?.container?.querySelectorAll(selectors) ?? null
// }

// function getElementById (this: microDocumentType, key: string): HTMLElement | null {
//   if (isInvalidQuerySelectorKey(key)) {
//     return globalEnv.rawGetElementById.call(globalEnv.rawDocument, key)
//   }

//   try {
//     return querySelector.call(this, `#${key}`)
//   } catch {
//     return globalEnv.rawGetElementById.call(globalEnv.rawDocument, key)
//   }
// }

// function getElementsByClassName (this: microDocumentType, key: string): HTMLCollectionOf<Element> {
//   if (isInvalidQuerySelectorKey(key)) {
//     return globalEnv.rawGetElementsByClassName.call(globalEnv.rawDocument, key)
//   }

//   try {
//     return querySelectorAll.call(this, `.${key}`)
//   } catch {
//     return globalEnv.rawGetElementsByClassName.call(globalEnv.rawDocument, key)
//   }
// }

// function getElementsByTagName (this: microDocumentType, key: string): HTMLCollectionOf<Element> {
//   if (
//     isUniqueElement(key) ||
//     isInvalidQuerySelectorKey(key) ||
//     (!appInstanceMap.get(this.__MICRO_APP_NAME__)?.inline && /^script$/i.test(key))
//   ) {
//     return globalEnv.rawGetElementsByTagName.call(globalEnv.rawDocument, key)
//   }

//   try {
//     return querySelectorAll.call(this, key)
//   } catch {
//     return globalEnv.rawGetElementsByTagName.call(globalEnv.rawDocument, key)
//   }
// }

// function getElementsByName (this: microDocumentType, key: string): NodeListOf<HTMLElement> {
//   if (isInvalidQuerySelectorKey(key)) {
//     return globalEnv.rawGetElementsByName.call(globalEnv.rawDocument, key)
//   }

//   try {
//     return querySelectorAll.call(this, `[name=${key}]`)
//   } catch {
//     return globalEnv.rawGetElementsByName.call(globalEnv.rawDocument, key)
//   }
// }

// function createElement (
//   this: microDocumentType,
//   tagName: string,
//   options?: ElementCreationOptions,
// ) {
//   const element = globalEnv.rawCreateElement.call(globalEnv.rawDocument, tagName, options)
//   element.__MICRO_APP_NAME__ = this.__MICRO_APP_NAME__
//   return element
// }

// function createElementNS (
//   this: microDocumentType,
//   namespaceURI: string,
//   name: string,
//   options?: string | ElementCreationOptions,
// ): any {
//   const element = globalEnv.rawCreateElementNS.call(globalEnv.rawDocument, namespaceURI, name, options)
//   element.__MICRO_APP_NAME__ = this.__MICRO_APP_NAME__
//   return element
// }

// function createDocumentFragment (
//   this: microDocumentType,
// ) {
//   const element = globalEnv.rawCreateDocumentFragment.call(globalEnv.rawDocument)
//   element.__MICRO_APP_NAME__ = this.__MICRO_APP_NAME__
//   return element
// }

/* eslint-disable camelcase */
export type injectDocumentDataType = {
  __MICRO_APP_NAME__: string
}

export type microDocumentType = Document & injectDocumentDataType

export default class MicroAppDocument {
  proxyDocument: Document
  microDocument = {} as microDocumentType

  constructor (appName: string) {
    this.microDocument.__MICRO_APP_NAME__ = appName
    this.proxyDocument = new Proxy(document, {
      get: (_target: Document, key: PropertyKey) => {
        switch (key) {
          case 'createElement':
            return createElement.bind(this.microDocument)
          case 'createElementNS':
            return createElementNS.bind(this.microDocument)
          case 'createDocumentFragment':
            return createDocumentFragment.bind(this.microDocument)
          case 'querySelector':
            return querySelector.bind(this.microDocument)
          case 'querySelectorAll':
            return querySelectorAll.bind(this.microDocument)
          case 'getElementById':
            return getElementById.bind(this.microDocument)
          case 'getElementsByClassName':
            return getElementsByClassName.bind(this.microDocument)
          case 'getElementsByTagName':
            return getElementsByTagName.bind(this.microDocument)
          case 'getElementsByName':
            return getElementsByName.bind(this.microDocument)
        }

        if (typeof globalEnv.rawDocument[key] === 'function') {
          return globalEnv.rawDocument[key].bind(globalEnv.rawDocument)
        }
        return globalEnv.rawDocument[key]
      },
      set (_target: Document, key: PropertyKey, value: unknown) {
        Reflect.set(globalEnv.rawDocument, key, value)
        return true
      }
    })
  }
}

// 原生：664 649 631 645 656 591 660 639 596 644 // 平均：637.5
// 重写：688 656 660 634 663 645 702 704 686 720 // 平均：675.8
// 派吃：638 674 646 629 625 631 637 754 705 668 // 平均：660.7
// 乾坤：
