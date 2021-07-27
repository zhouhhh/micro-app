declare module '@micro-app/types' {
  type AttrType = string | null

  type Func = (...rest: any[]) => void

  type microWindowType = Window & any

  interface SandBoxInterface {
    active: boolean // 沙箱状态
    proxyWindow: WindowProxy
    releaseEffect: CallableFunction
    // 强隔离的全局变量(只能在沙箱中获取和设置的属性，不会兜底到外层window)
    scopeProperties: Array<PropertyKey>
    // 可以泄漏到外部window的全局变量
    escapeProperties: Array<PropertyKey>
    microWindow: Window // 代理原型
    injectedKeys: Set<PropertyKey>// proxyWindow新添加的属性
    escapeKeys: Set<PropertyKey>// 泄漏到外部window的变量，卸载时清除
    start(baseurl: string): void
    stop(): void
    inject(microWindow: microWindowType, appName: string, url: string): void
  }

  interface MicroAppElementType {
    name: AttrType // 应用名称
    url: AttrType // 应用地址
    isWating: boolean // 是否正在合并执行
    cacheData: Record<PropertyKey, unknown> | null // data缓存数据
    connectedCallback(): void // 元素插入文档中的钩子函数
    disconnectedCallback(): void // 元素被删除的钩子函数
    attributeChangedCallback(a: 'name' | 'url', o: string, n: string): void // 监听属性发生变化
    handleAttributeUpdate(): void // 处理初始化后name或url发生变化
    legalAttribute(name: string, val: AttrType): boolean // 判断元素属性是否符合条件
    handleCreate(): void // 创建应用
    handleUnmount (destory: boolean): void // 卸载应用
    getDisposeResult (name: string): boolean // 获取配置结果
  }

  type sourceLinkInfo = {
    code: string // 代码内容
    placeholder?: Comment | null // 占位注释元素
    isGlobal: boolean // 是否全局资源
  }

  type sourceScriptInfo = {
    code: string // 代码内容
    isExternal: boolean // 是否是远程script
    isDynamic: boolean // 是否是动态创建的script
    async: boolean // 异步脚本
    defer: boolean // 延迟执行
    module: boolean // module类型
    isGlobal?: boolean // 是否是全局script
  }

  interface sourceType {
    html?: HTMLElement
    links: Map<string, sourceLinkInfo>
    scripts: Map<string, sourceScriptInfo>
  }

  // 微应用实例
  interface AppInterface {
    isPrefetch: boolean // 是否是预加载，默认false
    name: string // 应用名称
    url: string // 应用地址
    container: HTMLElement | ShadowRoot | null // dom容器
    inline: boolean // 是否使用内联script
    scopecss: boolean // 是否使用css隔离
    useSandbox: boolean // 是否开启沙盒
    macro: boolean // 是否使用宏任务延迟
    baseurl: string // 路由前缀
    source: sourceType // 资源列表
    sandBox: SandBoxInterface | null // 沙盒实例
    loadSourceCode(): void // 开始加载静态资源
    onLoad(html: HTMLElement): void // 资源加载完成，还没执行
    onLoadError(e: Error): void // 加载html静态资源失败
    mount(
      container?: HTMLElement | ShadowRoot,
      inline?: boolean,
      baseurl?: string,
    ): void // 初始化资源完成后进行渲染
    unmount(destory: boolean): void // 卸载应用
    onerror(e: Error): void // 渲染出错
    getAppStatus(): string // 获取应用状态
  }

  type prefetchParam = {
    name: string,
    url: string,
    disableScopecss?: boolean
    disableSandbox?: boolean
    macro?: boolean
    shadowDOM?: boolean
  }

  // 预加载入参
  type prefetchParamList = Array<prefetchParam> | (() => Array<prefetchParam>)

  // 声明周期
  interface lifeCyclesType {
    created?(e?: CustomEvent): void
    beforemount?(e?: CustomEvent): void
    mounted?(e?: CustomEvent): void
    unmount?(e?: CustomEvent): void
    error?(e?: CustomEvent): void
  }

  type plugins = {
    // 全局插件
    global?: Array<{
      // 强隔离的全局变量
      scopeProperties?: Array<PropertyKey>
      // 可以逃逸到外部的全局变量
      escapeProperties?: Array<PropertyKey>
      // 配置项
      options?: unknown
      // 处理函数
      loader?: (code: string, url: string, options: unknown) => string
    }>

    // 子应用单独配置插件
    modules?: {
      [name: string]: Array<{
        // 强隔离的全局变量
        scopeProperties?: Array<PropertyKey>
        // 可以逃逸到外部的全局变量
        escapeProperties?: Array<PropertyKey>
        // 配置项
        options?: unknown
        // 处理函数
        loader?: (code: string, url: string, options: unknown) => string
      }>
    }
  }

  type fetchType = (url: string, options: Record<string, unknown>, appName: string) => Promise<string>

  type OptionsType = {
    tagName?: string
    shadowDOM?: boolean
    destory?: boolean
    inline?: boolean
    disableScopecss?: boolean
    disableSandbox?: boolean
    macro?: boolean
    lifeCycles?: lifeCyclesType
    preFetchApps?: prefetchParamList
    plugins?: plugins
    fetch?: fetchType
  }

  // MicroApp 配置对象
  interface MicroAppConfigType {
    tagName: string
    shadowDOM?: boolean
    destory?: boolean
    inline?: boolean
    disableScopecss?: boolean
    disableSandbox?: boolean
    macro?: boolean
    lifeCycles?: lifeCyclesType
    plugins?: plugins
    fetch?: fetchType
    preFetch(apps: prefetchParamList): void
    start(options?: OptionsType): void
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    'micro-app': any
  }
}
