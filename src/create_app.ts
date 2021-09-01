import type {
  AppInterface,
  sourceType,
  SandBoxInterface,
  sourceLinkInfo,
  sourceScriptInfo,
  Func,
} from '@micro-app/types'
import extractHtml from './source'
import { execScripts } from './source/scripts'
import { appStatus, lifeCycles } from './constants'
import SandBox from './sandbox'
import { defer, isFunction } from './libs/utils'
import dispatchLifecyclesEvent, { dispatchUnmountToMicroApp } from './interact/lifecycles_event'

// micro app instances
export const appInstanceMap = new Map<string, AppInterface>()

// params of CreateApp
export interface CreateAppParam {
  name: string
  url: string
  scopecss: boolean
  useSandbox: boolean
  macro?: boolean
  inline?: boolean
  baseurl?: string
  container?: HTMLElement | ShadowRoot
}

export default class CreateApp implements AppInterface {
  private status: string = appStatus.NOT_LOADED
  private loadSourceLevel: -1|0|1|2 = 0
  isPrefetch = false
  name: string
  url: string
  container: HTMLElement | ShadowRoot | null = null
  inline: boolean
  scopecss: boolean
  useSandbox: boolean
  macro = false
  baseurl = ''
  source: sourceType
  sandBox: SandBoxInterface | null = null
  umdHookMount: Func | null = null
  umdHookunMount: Func | null = null

  constructor ({ name, url, container, inline, scopecss, useSandbox, macro, baseurl }: CreateAppParam) {
    this.container = container ?? null
    this.inline = inline ?? false
    this.baseurl = baseurl ?? ''
    // optional during init👆
    this.name = name
    this.url = url
    this.useSandbox = useSandbox
    this.scopecss = this.useSandbox && scopecss
    this.macro = macro ?? false
    this.source = {
      links: new Map<string, sourceLinkInfo>(),
      scripts: new Map<string, sourceScriptInfo>(),
    }
    this.loadSourceCode()
    if (this.useSandbox) {
      this.sandBox = new SandBox(name, url, this.macro)
    }
  }

  // Load resources
  loadSourceCode (): void {
    this.status = appStatus.LOADING_SOURCE_CODE
    extractHtml(this)
  }

  /**
   * When resource is loaded, mount app if it is not prefetch or unmount
   */
  onLoad (html: HTMLElement): void {
    if (++this.loadSourceLevel === 2) {
      this.source.html = html

      if (this.isPrefetch || this.status === appStatus.UNMOUNT) return

      this.status = appStatus.LOAD_SOURCE_FINISHED

      this.mount()
    }
  }

  /**
   * Error loading HTML
   * @param e Error
   */
  onLoadError (e: Error): void {
    this.loadSourceLevel = -1
    if (this.status !== appStatus.UNMOUNT) {
      this.onerror(e)
      this.status = appStatus.LOAD_SOURCE_ERROR
    }
  }

  /**
   * mount app
   * @param container app container
   * @param inline js runs in inline mode
   * @param baseurl route prefix, default is ''
   */
  mount (
    container?: HTMLElement | ShadowRoot,
    inline?: boolean,
    baseurl?: string,
  ): void {
    if (!this.container && container) {
      this.container = container
    }

    if (typeof inline === 'boolean' && inline !== this.inline) {
      this.inline = inline
    }

    this.baseurl = baseurl ?? this.baseurl

    if (this.loadSourceLevel !== 2) {
      this.status = appStatus.LOADING_SOURCE_CODE
      return
    }

    dispatchLifecyclesEvent(
      this.container as HTMLElement,
      this.name,
      lifeCycles.BEFOREMOUNT,
    )

    this.status = appStatus.MOUNTING

    const cloneHtml = this.source.html!.cloneNode(true)
    const fragment = document.createDocumentFragment()
    Array.from(cloneHtml.childNodes).forEach((node: Node) => {
      fragment.appendChild(node)
    })

    this.container!.appendChild(fragment)
    this.sandBox?.start(this.baseurl)
    if (!this.umdHookMount) {
      execScripts(this.source.scripts, this)

      const global = this.sandBox?.proxyWindow ?? window
      const { mount, unmount } = (global as any)[`micro-app-${this.name}`] ?? {}
      if (isFunction(mount) && isFunction(unmount)) {
        this.umdHookMount = mount as Func
        this.umdHookunMount = unmount as Func
        this.source.html!.innerHTML = this.container!.innerHTML
        this.umdHookMount()
      }
    } else {
      this.umdHookMount()
    }

    if (this.status !== appStatus.UNMOUNT) {
      this.status = appStatus.MOUNTED
      defer(() => {
        if (this.status !== appStatus.UNMOUNT) {
          dispatchLifecyclesEvent(
            this.container as HTMLElement,
            this.name,
            lifeCycles.MOUNTED,
          )
        }
      })
    }
  }

  /**
   * unmount app
   * @param destory completely destroyed, delete cache resources
   */
  unmount (destory: boolean): void {
    if (this.status === appStatus.LOAD_SOURCE_ERROR) {
      destory = true
    }
    this.status = appStatus.UNMOUNT
    dispatchLifecyclesEvent(
      this.container as HTMLElement,
      this.name,
      lifeCycles.UNMOUNT,
    )
    // Send an unmount event to the micro application, which is triggered before the sandbox is cleared & after the unmount lifecycle is executed
    dispatchUnmountToMicroApp(this.name)
    this.sandBox?.stop()
    this.container = null
    if (destory) {
      appInstanceMap.delete(this.name)
    }
  }

  /**
   * app rendering error
   * @param e Error
   */
  onerror (e: Error): void {
    dispatchLifecyclesEvent(
      this.container as HTMLElement,
      this.name,
      lifeCycles.ERROR,
      e,
    )
  }

  // get app status
  getAppStatus (): string {
    return this.status
  }
}
