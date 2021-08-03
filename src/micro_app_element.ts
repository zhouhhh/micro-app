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

  // 👇可配置项
  // shadowDom 开启shadowDOM，默认为false
  // destory 卸载时是否强制删除缓存资源，默认为false
  // inline js以内联script方式运行，默认为false
  // disableScopecss 禁用css隔离，默认为false
  // disableSandbox 停用js沙盒，默认为false
  // macro 用于解决vue3的异步渲染问题，和预加载的入参保持一致，默认为false
  // baseUrl 路由前缀，默认为 ''

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
   * 处理初始化后name或url发生变化
   * 只要name或url发生变化，则将旧应用完全卸载，并渲染新的应用
   */
  handleAttributeUpdate = (): void => {
    this.isWating = false
    const attrName = this.getAttribute('name')
    const attrUrl = formatURL(this.getAttribute('url'))
    if (this.legalAttribute('name', attrName) && this.legalAttribute('url', attrUrl)) {
      const existApp = appInstanceMap.get(attrName!)
      if (attrName !== this.name && existApp) {
        // 处理已缓存的非预加载app
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
        if (existApp?.isPrefetch) {
          // 预加载app直接挂载
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
   * 判断元素属性是否符合条件
   * @param name 属性名称
   * @param val 属性值
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

  // 加载预加载应用
  handleAppMount (app: AppInterface): void {
    app.isPrefetch = false
    defer(() => app.mount(
      this.shadowRoot ?? this,
      this.getDisposeResult('inline'),
      this.getAttribute('baseurl') ?? '',
    ))
  }

  // 创建应用
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
   * 卸载应用
   * @param destory 是否完全销毁
   */
  handleUnmount (destory: boolean): void {
    const app = appInstanceMap.get(this.name!)
    if (app && app.getAppStatus() !== appStatus.UNMOUNT) app.unmount(destory)
  }

  /**
   * 获取配置结果
   * 全局的优先级最低
   * @param name 名称
   */
  getDisposeResult (name: string): boolean {
    // @ts-ignore
    return (this.hasAttribute(name) || microApp[name]) && this.getAttribute(name) !== 'false'
  }

  /**
   * 基座应用传入的数据
   */
  set data (value: Record<PropertyKey, unknown> | null) {
    if (this.name) {
      microApp.setData(this.name, value!)
    } else {
      this.cacheData = value
    }
  }

  /**
   * data取值只在jsx-custom-event中使用一次
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
 * 定义元素
 * @param tagName 元素名称
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
