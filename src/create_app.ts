import type {
  AppInterface,
  sourceType,
  SandBoxInterface,
  sourceLinkInfo,
  sourceScriptInfo,
} from '@micro-app/types'
import extractHtml from './source'
import { execScripts } from './source/scripts'
import { appStatus, lifeCycles } from './constants'
import SandBox from './sandbox'
import { defer } from './libs/utils'
import dispatchLifecyclesEvent, { dispatchUnmountToMicroApp } from './interact/lifecycles_event'

// 微应用实例
export const appInstanceMap = new Map<string, AppInterface>()

// CreateApp构造函数入参
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
  private loadSourceLevel: -1|0|1|2 = 0 // level为2，资源加载完成
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

  constructor ({ name, url, container, inline, scopecss, useSandbox, macro, baseurl }: CreateAppParam) {
    this.container = container ?? null
    this.inline = inline ?? false
    this.baseurl = baseurl ?? ''
    // 初始化时非必传👆
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

  // 加载资源
  loadSourceCode (): void {
    this.status = appStatus.LOADING_SOURCE_CODE
    extractHtml(this)
  }

  /**
   * 资源加载完成，非预加载和卸载时执行mount操作
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
   * 加载html资源出错
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
   * 初始化资源完成后进行渲染
   * @param container 容器
   * @param inline 是否使用内联模式
   * @param baseurl 路由前缀，每个应用的前缀都是不同的，兜底为空字符串
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

    execScripts(this.source.scripts, this)

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
   * 应用卸载
   * @param destory 是否完全销毁，删除缓存资源
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
    // 向微应用发送卸载事件，在沙盒清空之前&声明周期执行之后触发
    dispatchUnmountToMicroApp(this.name)
    this.sandBox?.stop()
    this.container = null
    if (destory) {
      appInstanceMap.delete(this.name)
    }
  }

  /**
   * 阻断应用正常渲染的错误钩子
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

  // 获取应用状态
  getAppStatus (): string {
    return this.status
  }
}
