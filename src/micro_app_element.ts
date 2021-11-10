import type { AttrType, MicroAppElementType, AppInterface } from '@micro-app/types'
import {
  defer,
  formatName,
  formatURL,
  version,
  logError,
  logWarn,
  isString,
  isFunction,
} from './libs/utils'
import { ObservedAttrName, appStatus, lifeCycles } from './constants'
import CreateApp, { appInstanceMap } from './create_app'
import {
  patchElementPrototypeMethods,
  releasePatches,
  rejectMicroAppStyle,
} from './source/patch'
import {
  listenUmountOfNestedApp,
  replaseUnmountOfNestedApp,
} from './libs/additional'
import microApp from './micro_app'
import dispatchLifecyclesEvent from './interact/lifecycles_event'

// record all micro-app elements
export const elementInstanceMap = new Map<Element, boolean>()

/**
 * define element
 * @param tagName element name
 */
export function defineElement (tagName: string): void {
  class MicroAppElement extends HTMLElement implements MicroAppElementType {
    static get observedAttributes (): string[] {
      return ['name', 'url']
    }

    constructor () {
      super()
      // cloned node of umd container also trigger constructor, we should skip
      if (!this.querySelector('micro-app-head')) {
        this.performWhenFirstCreated()
      }
    }

    private isWating = false
    private cacheData: Record<PropertyKey, unknown> | null = null
    private hasConnected = false
    appName = ''
    appUrl = ''
    version = version

    // 👇 Configuration
    // name: app name
    // url: html address
    // shadowDom: use shadowDOM, default is false
    // destroy: whether delete cache resources when unmount, default is false
    // inline: whether js runs in inline script mode, default is false
    // disableScopecss: whether disable css scoped, default is false
    // disableSandbox: whether disable sandbox, default is false
    // macro: used to solve the async render problem of vue3, default is false
    // baseRoute: route prefix, default is ''

    connectedCallback (): void {
      this.hasConnected = true
      if (!elementInstanceMap.has(this)) {
        this.performWhenFirstCreated()
      }

      defer(() => dispatchLifecyclesEvent(
        this,
        this.appName,
        lifeCycles.CREATED,
      ))

      this.initialMount()
    }

    disconnectedCallback (): void {
      this.hasConnected = false
      elementInstanceMap.delete(this)
      this.handleUnmount(this.getDisposeResult('destroy') || this.getDisposeResult('destory'))
      if (elementInstanceMap.size === 0) {
        releasePatches()
      }
    }

    attributeChangedCallback (attr: ObservedAttrName, _oldVal: string, newVal: string): void {
      if (
        this.legalAttribute(attr, newVal) &&
        this[attr === ObservedAttrName.NAME ? 'appName' : 'appUrl'] !== newVal
      ) {
        if (attr === ObservedAttrName.URL && !this.appUrl) {
          newVal = formatURL(newVal, this.appName)
          if (!newVal) {
            return logError(`Invalid attribute url ${newVal}`, this.appName)
          }
          this.appUrl = newVal
          this.handleInitialNameAndUrl()
        } else if (attr === ObservedAttrName.NAME && !this.appName) {
          const formatNewName = formatName(newVal)

          if (!formatNewName) {
            return logError(`Invalid attribute name ${newVal}`, this.appName)
          }

          if (this.cacheData) {
            microApp.setData(formatNewName, this.cacheData)
            this.cacheData = null
          }

          this.appName = formatNewName
          if (formatNewName !== newVal) {
            this.setAttribute('name', this.appName)
          }
          this.handleInitialNameAndUrl()
        } else if (!this.isWating) {
          this.isWating = true
          defer(this.handleAttributeUpdate)
        }
      }
    }

    // handle for connectedCallback run before attributeChangedCallback
    private handleInitialNameAndUrl (): void {
      if (this.hasConnected) {
        this.initialMount()
      }
    }

    // Perform global initialization when the element count is 1
    private performWhenFirstCreated (): void {
      if (elementInstanceMap.set(this, true).size === 1) {
        patchElementPrototypeMethods()
        rejectMicroAppStyle()
        replaseUnmountOfNestedApp()
        listenUmountOfNestedApp()
      }
    }

    /**
     * first mount of this app
     */
    private initialMount (): void {
      if (!this.appName || !this.appUrl) return

      if (this.getDisposeResult('shadowDOM') && !this.shadowRoot && isFunction(this.attachShadow)) {
        this.attachShadow({ mode: 'open' })
      }

      const app = appInstanceMap.get(this.appName)
      if (app) {
        if (
          app.url === this.appUrl && (
            app.isPrefetch ||
            app.getAppStatus() === appStatus.UNMOUNT
          )
        ) {
          this.handleAppMount(app)
        } else if (app.isPrefetch || app.getAppStatus() === appStatus.UNMOUNT) {
          /**
           * url is different & old app is unmounted or prefetch, create new app to replace old one
           */
          logWarn(`the ${app.isPrefetch ? 'prefetch' : 'unmounted'} app with name ${this.appName} and url ${app.url} is replaced by a new one`, this.appName)
          this.handleCreateApp()
        } else {
          logError(`an app named ${this.appName} already exists`, this.appName)
        }
      } else {
        this.handleCreateApp()
      }
    }

    /**
     * handle for change of name an url after element inited
     */
    private handleAttributeUpdate = (): void => {
      this.isWating = false
      const formatAttrName = formatName(this.getAttribute('name'))
      const formatAttrUrl = formatURL(this.getAttribute('url'), this.appName)
      if (this.legalAttribute('name', formatAttrName) && this.legalAttribute('url', formatAttrUrl)) {
        const existApp = appInstanceMap.get(formatAttrName)
        if (formatAttrName !== this.appName && existApp) {
          // handling of cached and non-prefetch apps
          if (appStatus.UNMOUNT !== existApp.getAppStatus() && !existApp.isPrefetch) {
            this.setAttribute('name', this.appName)
            return logError(`an app named ${formatAttrName} already exists`, this.appName)
          }
        }

        if (formatAttrName !== this.appName || formatAttrUrl !== this.appUrl) {
          this.handleUnmount(formatAttrName === this.appName)
          this.appName = formatAttrName as string
          this.appUrl = formatAttrUrl
          ;(this.shadowRoot ?? this).innerHTML = ''
          if (formatAttrName !== this.getAttribute('name')) {
            this.setAttribute('name', this.appName)
          }
          /**
           * when existApp not null
           * if formatAttrName and this.appName are equal: exitApp is the current app, the url must be different, existApp has been unmounted
           * if formatAttrName and this.appName are different: existApp must be prefetch or unmounted, if url is equal, then just mount, if url is different, then create new app to replace existApp
           */
          if (existApp && existApp.url === formatAttrUrl) {
            // mount app
            this.handleAppMount(existApp)
          } else {
            this.handleCreateApp()
          }
        }
      } else if (formatAttrName !== this.appName) {
        this.setAttribute('name', this.appName)
      }
    }

    /**
     * judge the attribute is legal
     * @param name attribute name
     * @param val attribute value
     */
    private legalAttribute (name: string, val: AttrType): boolean {
      if (!isString(val) || !val) {
        logError(`unexpected attribute ${name}, please check again`, this.appName)

        return false
      }

      return true
    }

    /**
     * mount app
     * some serious note before mount:
     * 1. is prefetch ?
     * 2. is remount in another container ?
     * 3. is remount with change properties of the container ?
     */
    private handleAppMount (app: AppInterface): void {
      app.isPrefetch = false
      defer(() => app.mount(
        this.shadowRoot ?? this,
        this.getDisposeResult('inline'),
        this.getBaseRouteCompatible(),
      ))
    }

    // create app instance
    private handleCreateApp (): void {
      /**
       * actions for destory old app
       * fix of unmounted umd app with disableSandbox
       */
      if (appInstanceMap.has(this.appName)) {
        appInstanceMap.get(this.appName)!.actionsForCompletelyDestory()
      }

      const instance: AppInterface = new CreateApp({
        name: this.appName,
        url: this.appUrl,
        container: this.shadowRoot ?? this,
        inline: this.getDisposeResult('inline'),
        scopecss: !(this.getDisposeResult('disableScopecss') || this.getDisposeResult('shadowDOM')),
        useSandbox: !this.getDisposeResult('disableSandbox'),
        macro: this.getDisposeResult('macro'),
        baseroute: this.getBaseRouteCompatible(),
      })

      appInstanceMap.set(this.appName, instance)
    }

    /**
     * unmount app
     * @param destroy delete cache resources when unmount
     */
    private handleUnmount (destroy: boolean): void {
      const app = appInstanceMap.get(this.appName)
      if (app && appStatus.UNMOUNT !== app.getAppStatus()) app.unmount(destroy)
    }

    /**
     * Get configuration
     * Global setting is lowest priority
     * @param name Configuration item name
     */
    private getDisposeResult (name: string): boolean {
      // @ts-ignore
      return (this.hasAttribute(name) || microApp[name]) && this.getAttribute(name) !== 'false'
    }

    /**
     * 2021-09-08
     * get baseRoute
     * getAttribute('baseurl') is compatible writing of versions below 0.3.1
     */
    private getBaseRouteCompatible (): string {
      return this.getAttribute('baseroute') ?? this.getAttribute('baseurl') ?? ''
    }

    /**
     * Data from the base application
     */
    set data (value: Record<PropertyKey, unknown> | null) {
      if (this.appName) {
        microApp.setData(this.appName, value!)
      } else {
        this.cacheData = value
      }
    }

    /**
     * get data only used in jsx-custom-event once
     */
    get data (): Record<PropertyKey, unknown> | null {
      if (this.appName) {
        return microApp.getData(this.appName, true)
      } else if (this.cacheData) {
        return this.cacheData
      }
      return null
    }
  }

  window.customElements.define(tagName, MicroAppElement)
}
