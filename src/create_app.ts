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
import { formatHTMLStyleAfterUmdInit } from './source/links'
import { appStatus, lifeCycles } from './constants'
import SandBox from './sandbox'
import { defer, isFunction, cloneNode } from './libs/utils'
import dispatchLifecyclesEvent, { dispatchUnmountToMicroApp } from './interact/lifecycles_event'
import globalEnv from './libs/global_env'

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
  baseroute?: string
  container?: HTMLElement | ShadowRoot
}

export default class CreateApp implements AppInterface {
  private status: string = appStatus.NOT_LOADED
  private loadSourceLevel: -1|0|1|2 = 0
  private umdHookMount: Func | null = null
  private umdHookunMount: Func | null = null
  isPrefetch = false
  name: string
  url: string
  container: HTMLElement | ShadowRoot | null = null
  inline: boolean
  scopecss: boolean
  useSandbox: boolean
  macro = false
  baseroute = ''
  source: sourceType
  sandBox: SandBoxInterface | null = null

  constructor ({ name, url, container, inline, scopecss, useSandbox, macro, baseroute }: CreateAppParam) {
    this.container = container ?? null
    this.inline = inline ?? false
    this.baseroute = baseroute ?? ''
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

      if (this.isPrefetch || appStatus.UNMOUNT === this.status) return

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
    if (appStatus.UNMOUNT !== this.status) {
      this.onerror(e)
      this.status = appStatus.LOAD_SOURCE_ERROR
    }
  }

  /**
   * mount app
   * @param container app container
   * @param inline js runs in inline mode
   * @param baseroute route prefix, default is ''
   */
  mount (
    container?: HTMLElement | ShadowRoot,
    inline?: boolean,
    baseroute?: string,
  ): void {
    if (typeof inline === 'boolean' && inline !== this.inline) {
      this.inline = inline
    }

    this.container = this.container ?? container!
    this.baseroute = baseroute ?? this.baseroute

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

    cloneNode(this.source.html!, this.container! as Element)

    this.sandBox?.start(this.baseroute)
    if (!this.umdHookMount) {
      execScripts(this.source.scripts, this, (isFinished: boolean) => {
        if (this.umdHookMount === null) {
          const { mount, unmount } = this.getUmdLibraryHooks()
          // if mount & unmount is function, the sub app is umd mode
          if (isFunction(mount) && isFunction(unmount)) {
            this.umdHookMount = mount as Func
            this.umdHookunMount = unmount as Func
            this.sandBox?.recordUmdSnapshot()
            /**
             * TODO: Some UI frameworks insert and record container elements to micro-app-body, such as modal and notification. The DOM remounted is a cloned element, so the cached elements of UI frameworks are invalid, this may cause bug when remount app
             */
            cloneNode(this.container! as Element, this.source.html!)
            formatHTMLStyleAfterUmdInit(this.source.html!, this.name)
            this.umdHookMount()
          }
        }
        if (isFinished === true) {
          this.dispatchMountedEvent()
        }
      })
    } else {
      this.sandBox?.rebuildUmdSnapshot()
      this.umdHookMount()
      this.dispatchMountedEvent()
    }
  }

  /**
   * dispatch mounted event when app run finished
   */
  dispatchMountedEvent (): void {
    if (appStatus.UNMOUNT !== this.status) {
      this.status = appStatus.MOUNTED
      defer(() => {
        if (appStatus.UNMOUNT !== this.status) {
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
    // Send an unmount event to the micro app or call umd unmount hook
    // before the sandbox is cleared & after the unmount lifecycle is executed
    this.umdHookunMount && this.umdHookunMount()
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

  // get umd library, if it not exist, return empty object
  private getUmdLibraryHooks (): any {
    // after execScripts, the app maybe unmounted
    if (appStatus.UNMOUNT !== this.status) {
      const global = (this.sandBox?.proxyWindow ?? globalEnv.rawWindow) as any
      const libraryName = (this.container instanceof ShadowRoot ? this.container.host : this.container)!.getAttribute('library') || `micro-app-${this.name}`
      return typeof global[libraryName] === 'object' ? global[libraryName] : {}
    }

    return {}
  }
}
