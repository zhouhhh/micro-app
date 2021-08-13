import type { AttrType, MicroAppElementType, AppInterface } from '@micro-app/types'
import { formatLogMessage, defer, formatURL, version } from './libs/utils'
import { ObservedAttrName, appStatus, lifeCycles } from './constants'
import CreateApp, { appInstanceMap } from './create_app'
import {
  patchElementPrototypeMethods,
  releasePatches,
  rejectMicroAppStyle,
} from './source/patch'
import microApp from './micro_app'
import dispatchLifecyclesEvent from './interact/lifecycles_event'
import { listenUmountAppInline, replaseUnmountAppInline } from './libs/additional'

export default class MicroAppElement extends HTMLElement implements MicroAppElementType {
  static microAppCount = 0
  static get observedAttributes (): string[] {
    return ['name', 'url']
  }

  name = ''
  url = ''
  version = version
  isWating = false
  cacheData: Record<PropertyKey, unknown> | null = null

  // 👇Configuration
  // shadowDom: use shadowDOM, default is false
  // destory: whether delete cache resources when unmount, default is false
  // inline: whether js runs in inline script mode, default is false
  // disableScopecss: whether disable css scoped, default is false
  // disableSandbox: whether disable sandbox, default is false
  // macro: used to solve the async render problem of vue3, default is false
  // baseUrl: route prefix, default is ''

  connectedCallback (): void {
    if (++MicroAppElement.microAppCount === 1) {
      patchElementPrototypeMethods()
      rejectMicroAppStyle()
      listenUmountAppInline()
    }

    defer(() => dispatchLifecyclesEvent(
      this,
      this.name,
      lifeCycles.CREATED,
    ))

    if (!this.name || !this.url) return

    if (this.getDisposeResult('shadowDOM') && !this.shadowRoot) {
      this.attachShadow({ mode: 'open' })
    }

    const app = appInstanceMap.get(this.name)
    if (app) {
      if (
        app.url === this.url && (
          app.isPrefetch ||
          app.getAppStatus() === appStatus.UNMOUNT
        )
      ) {
        this.handleAppMount(app)
      } else if (app.isPrefetch) {
        console.error(
          formatLogMessage(`the url: ${this.url} is different from prefetch url: ${app.url}`)
        )
      } else {
        console.error(
          formatLogMessage(`an app named ${this.name} already exists`)
        )
      }
    } else {
      this.handleCreate()
    }
  }

  disconnectedCallback (): void {
    if (MicroAppElement.microAppCount > 0) {
      this.handleUnmount(this.getDisposeResult('destory'))
      if (--MicroAppElement.microAppCount === 0) {
        releasePatches()
        replaseUnmountAppInline()
      }
    }
  }

  attributeChangedCallback (attr: ObservedAttrName, _oldVal: string, newVal: string): void {
    if (this.legalAttribute(attr, newVal) && this[attr] !== newVal) {
      if (attr === ObservedAttrName.URL && !this.url) {
        newVal = formatURL(newVal)
        if (!newVal) {
          return console.error(
            formatLogMessage('Invalid attribute url')
          )
        }
        this.url = newVal
      } else if (attr === ObservedAttrName.NAME && !this.name) {
        if (this.cacheData) {
          microApp.setData(newVal, this.cacheData)
          this.cacheData = null
        }
        this.name = newVal
      } else if (!this.isWating) {
        this.isWating = true
        defer(this.handleAttributeUpdate)
      }
    }
  }

  /**
   * handle for change of name an url after element inited
   */
  handleAttributeUpdate = (): void => {
    this.isWating = false
    const attrName = this.getAttribute('name')
    const attrUrl = formatURL(this.getAttribute('url'))
    if (this.legalAttribute('name', attrName) && this.legalAttribute('url', attrUrl)) {
      const existApp = appInstanceMap.get(attrName!)
      if (attrName !== this.name && existApp) {
        // handling of cached and non-prefetch apps
        if (existApp.getAppStatus() !== appStatus.UNMOUNT && !existApp.isPrefetch) {
          this.setAttribute('name', this.name)
          return console.error(
            formatLogMessage(`an app named ${attrName} already exists`)
          )
        }
      }

      if (attrName !== this.name || attrUrl !== this.url) {
        this.handleUnmount(true)
        this.name = attrName as string
        this.url = attrUrl
        ;(this.shadowRoot ?? this).innerHTML = ''
        /**
         * when existApp not undefined
         * if attrName and this.name are equal, existApp has been unmounted
         * if attrName and this.name are not equal, existApp is prefetch or unmounted
         */
        if (existApp && existApp.url === attrUrl) {
          // mount app
          this.handleAppMount(existApp)
        } else {
          this.handleCreate()
        }
      }
    } else if (attrName !== this.name) {
      this.setAttribute('name', this.name)
    }
  }

  /**
   * judge the attribute is legal
   * @param name attribute name
   * @param val attribute value
   */
  legalAttribute (name: string, val: AttrType): boolean {
    if (typeof val !== 'string' || !val) {
      console.error(
        formatLogMessage(`unexpected attribute ${name}, please check again`)
      )

      return false
    }

    return true
  }

  // mount app
  handleAppMount (app: AppInterface): void {
    app.isPrefetch = false
    defer(() => app.mount(
      this.shadowRoot ?? this,
      this.getDisposeResult('inline'),
      this.getAttribute('baseurl') ?? '',
    ))
  }

  // create app instance
  handleCreate (): void {
    const instance: AppInterface = new CreateApp({
      name: this.name!,
      url: this.url!,
      container: this.shadowRoot ?? this,
      inline: this.getDisposeResult('inline'),
      scopecss: !(this.getDisposeResult('disableScopecss') || this.getDisposeResult('shadowDOM')),
      useSandbox: !this.getDisposeResult('disableSandbox'),
      macro: this.getDisposeResult('macro'),
      baseurl: this.getAttribute('baseurl') ?? '',
    })

    appInstanceMap.set(this.name!, instance)
  }

  /**
   * unmount app
   * @param destory delete cache resources when unmount
   */
  handleUnmount (destory: boolean): void {
    const app = appInstanceMap.get(this.name!)
    if (app && app.getAppStatus() !== appStatus.UNMOUNT) app.unmount(destory)
  }

  /**
   * Get configuration
   * Global setting is lowest priority
   * @param name Configuration item name
   */
  getDisposeResult (name: string): boolean {
    // @ts-ignore
    return (this.hasAttribute(name) || microApp[name]) && this.getAttribute(name) !== 'false'
  }

  /**
   * Data from the base application
   */
  set data (value: Record<PropertyKey, unknown> | null) {
    if (this.name) {
      microApp.setData(this.name, value!)
    } else {
      this.cacheData = value
    }
  }

  /**
   * get data only used in jsx-custom-event once
   */
  get data (): Record<PropertyKey, unknown> | null {
    if (this.name) {
      return microApp.getData(this.name, true)
    } else if (this.cacheData) {
      return this.cacheData
    }
    return null
  }
}

/**
 * define element
 * @param tagName element name
 */
export function defineElement (tagName: string): boolean {
  if (window.customElements.get(tagName)) {
    console.warn(
      formatLogMessage(`element ${tagName} is already defined`)
    )
    return false
  }

  window.customElements.define(tagName, MicroAppElement)

  return true
}
