import type { microAppWindowType, SandBoxInterface } from '@micro-app/types'
import {
  EventCenterForMicroApp, rebuildDataCenterSnapshot, recordDataCenterSnapshot
} from '../interact'
import globalEnv from '../libs/global_env'
import {
  getEffectivePath,
  isArray,
  isPlainObject,
  isString,
  removeDomScope,
  unique,
  throttleDeferForSetAppName,
  rawDefineProperty,
  rawDefineProperties,
} from '../libs/utils'
import microApp from '../micro_app'
import bindFunctionToRawWindow from './bind_function'
import effect, { effectDocumentEvent, releaseEffectDocumentEvent } from './effect'

/* eslint-disable camelcase */
export type MicroAppWindowDataType = {
  __MICRO_APP_ENVIRONMENT__: boolean
  __MICRO_APP_NAME__: string
  __MICRO_APP_PUBLIC_PATH__: string
  __MICRO_APP_BASE_URL__: string
  __MICRO_APP_BASE_ROUTE__: string
  __MICRO_APP_UMDMODE__: boolean
  microApp: EventCenterForMicroApp
  rawWindow: Window
  rawDocument: Document
  removeDomScope: () => void
}

export type MicroAppWindowType = Window & MicroAppWindowDataType

// Variables that can escape to rawWindow
const staticEscapeProperties: PropertyKey[] = [
  'System',
  '__cjsWrapper',
]

// Variables that can only assigned to rawWindow
const escapeSetterKeyList: PropertyKey[] = [
  'location',
]

const globalPropertyList: Array<PropertyKey> = ['window', 'self', 'globalThis']

export default class SandBox implements SandBoxInterface {
  static activeCount = 0 // number of active sandbox
  // @ts-ignore
  private recordUmdEffect: CallableFunction
  // @ts-ignore
  private rebuildUmdEffect: CallableFunction
  // @ts-ignore
  private releaseEffect: CallableFunction
  // Scoped global Properties(Properties that can only get and set in microAppWindow, will not escape to rawWindow)
  private scopeProperties: PropertyKey[] = ['webpackJsonp']
  // Properties that can be escape to rawWindow
  private escapeProperties: PropertyKey[] = []
  // Properties newly added to microAppWindow
  private injectedKeys = new Set<PropertyKey>()
  // Properties escape to rawWindow, cleared when unmount
  private escapeKeys = new Set<PropertyKey>()
  // record injected values before the first execution of umdHookMount and rebuild before remount umd app
  private recordUmdinjectedValues?: Map<PropertyKey, unknown>
  // sandbox state
  private active = false
  proxyWindow: WindowProxy // Proxy
  microAppWindow = {} as MicroAppWindowType // Proxy target

  constructor (appName: string, url: string) {
    const rawWindow = globalEnv.rawWindow
    // get scopeProperties and escapeProperties from plugins
    this.getScopeProperties(appName)
    // Rewrite global event listener & timeout
    Object.assign(this, effect(this.microAppWindow))

    // window.xxx will trigger proxy
    this.proxyWindow = new Proxy(this.microAppWindow, {
      get: (target: microAppWindowType, key: PropertyKey): unknown => {
        if (
          Reflect.has(target, key) ||
          (isString(key) && /^__MICRO_APP_/.test(key)) ||
          this.scopeProperties.includes(key)
        ) return Reflect.get(target, key)

        const rawValue = Reflect.get(rawWindow, key)

        return bindFunctionToRawWindow(rawWindow, rawValue)
      },
      set: (target: microAppWindowType, key: PropertyKey, value: unknown): boolean => {
        if (this.active) {
          if (escapeSetterKeyList.includes(key)) {
            Reflect.set(rawWindow, key, value)
          } else if (
            !target.hasOwnProperty(key) &&
            rawWindow.hasOwnProperty(key) &&
            !this.scopeProperties.includes(key)
          ) {
            const descriptor = Object.getOwnPropertyDescriptor(rawWindow, key)
            const { configurable, enumerable, writable, set } = descriptor!
            // set value because it can be set
            rawDefineProperty(target, key, {
              value,
              configurable,
              enumerable,
              writable: writable ?? !!set,
            })

            this.injectedKeys.add(key)
          } else {
            Reflect.set(target, key, value)
            this.injectedKeys.add(key)
          }

          if (
            (
              this.escapeProperties.includes(key) ||
              (staticEscapeProperties.includes(key) && !Reflect.has(rawWindow, key))
            ) &&
            !this.scopeProperties.includes(key)
          ) {
            Reflect.set(rawWindow, key, value)
            this.escapeKeys.add(key)
          }
        }

        return true
      },
      has: (target: microAppWindowType, key: PropertyKey): boolean => {
        if (this.scopeProperties.includes(key)) return key in target
        return key in target || key in rawWindow
      },
      // Object.getOwnPropertyDescriptor(window, key)
      getOwnPropertyDescriptor: (target: microAppWindowType, key: PropertyKey): PropertyDescriptor|undefined => {
        if (target.hasOwnProperty(key)) {
          return Object.getOwnPropertyDescriptor(target, key)
        }

        if (rawWindow.hasOwnProperty(key)) {
          // console, alert ...
          return Object.getOwnPropertyDescriptor(rawWindow, key)
        }

        return undefined
      },
      // Object.getOwnPropertyNames(window)
      ownKeys: (target: microAppWindowType): Array<string | symbol> => {
        return unique(Reflect.ownKeys(rawWindow).concat(Reflect.ownKeys(target)))
      },
      deleteProperty: (target: microAppWindowType, key: PropertyKey): boolean => {
        if (target.hasOwnProperty(key)) {
          this.injectedKeys.has(key) && this.injectedKeys.delete(key)
          this.escapeKeys.has(key) && Reflect.deleteProperty(rawWindow, key)
          return Reflect.deleteProperty(target, key)
        }
        return true
      },
    })

    // inject global properties
    this.initmicroAppWindow(this.microAppWindow, appName, url)
  }

  start (baseroute: string): void {
    if (!this.active) {
      this.active = true
      this.microAppWindow.__MICRO_APP_BASE_ROUTE__ = this.microAppWindow.__MICRO_APP_BASE_URL__ = baseroute
      // BUG FIX: bable-polyfill@6.x
      globalEnv.rawWindow._babelPolyfill && (globalEnv.rawWindow._babelPolyfill = false)
      if (++SandBox.activeCount === 1) {
        effectDocumentEvent()
      }
    }
  }

  stop (): void {
    if (this.active) {
      this.active = false
      this.releaseEffect()
      this.microAppWindow.microApp.clearDataListener()
      this.microAppWindow.microApp.clearGlobalDataListener()

      this.injectedKeys.forEach((key: PropertyKey) => {
        Reflect.deleteProperty(this.microAppWindow, key)
      })
      this.injectedKeys.clear()

      this.escapeKeys.forEach((key: PropertyKey) => {
        Reflect.deleteProperty(globalEnv.rawWindow, key)
      })
      this.escapeKeys.clear()

      if (--SandBox.activeCount === 0) {
        releaseEffectDocumentEvent()
      }
    }
  }

  // record umd snapshot before the first execution of umdHookMount
  recordUmdSnapshot (): void {
    this.microAppWindow.__MICRO_APP_UMD_MODE__ = true
    this.recordUmdEffect()
    recordDataCenterSnapshot(this.microAppWindow.microApp)

    this.recordUmdinjectedValues = new Map<PropertyKey, unknown>()
    this.injectedKeys.forEach((key: PropertyKey) => {
      this.recordUmdinjectedValues!.set(key, Reflect.get(this.microAppWindow, key))
    })
  }

  // rebuild umd snapshot before remount umd app
  rebuildUmdSnapshot (): void {
    this.recordUmdinjectedValues!.forEach((value: unknown, key: PropertyKey) => {
      Reflect.set(this.proxyWindow, key, value)
    })
    this.rebuildUmdEffect()
    rebuildDataCenterSnapshot(this.microAppWindow.microApp)
  }

  /**
   * get scopeProperties and escapeProperties from plugins
   * @param appName app name
   */
  private getScopeProperties (appName: string): void {
    if (!isPlainObject(microApp.plugins)) return

    if (isArray(microApp.plugins!.global)) {
      for (const plugin of microApp.plugins!.global) {
        if (isPlainObject(plugin)) {
          if (isArray(plugin.scopeProperties)) {
            this.scopeProperties = this.scopeProperties.concat(plugin.scopeProperties!)
          }
          if (isArray(plugin.escapeProperties)) {
            this.escapeProperties = this.escapeProperties.concat(plugin.escapeProperties!)
          }
        }
      }
    }

    if (isArray(microApp.plugins!.modules?.[appName])) {
      for (const plugin of microApp.plugins!.modules![appName]) {
        if (isPlainObject(plugin)) {
          if (isArray(plugin.scopeProperties)) {
            this.scopeProperties = this.scopeProperties.concat(plugin.scopeProperties!)
          }
          if (isArray(plugin.escapeProperties)) {
            this.escapeProperties = this.escapeProperties.concat(plugin.escapeProperties!)
          }
        }
      }
    }
  }

  /**
   * inject global properties to microAppWindow
   * @param microAppWindow micro window
   * @param appName app name
   * @param url app url
   */
  private initmicroAppWindow (microAppWindow: microAppWindowType, appName: string, url: string): void {
    microAppWindow.__MICRO_APP_ENVIRONMENT__ = true
    microAppWindow.__MICRO_APP_NAME__ = appName
    microAppWindow.__MICRO_APP_PUBLIC_PATH__ = getEffectivePath(url)
    microAppWindow.__MICRO_APP_WINDOW__ = microAppWindow
    microAppWindow.microApp = new EventCenterForMicroApp(appName)
    microAppWindow.rawWindow = globalEnv.rawWindow
    microAppWindow.rawDocument = globalEnv.rawDocument
    microAppWindow.removeDomScope = removeDomScope
    microAppWindow.hasOwnProperty = (key: PropertyKey) => Object.prototype.hasOwnProperty.call(microAppWindow, key) || Object.prototype.hasOwnProperty.call(globalEnv.rawWindow, key)
    this.setMappingPropertiesWithRawDescriptor(microAppWindow)
    this.setHijackProperties(microAppWindow, appName)
  }

  // properties associated with the native window
  private setMappingPropertiesWithRawDescriptor (microAppWindow: microAppWindowType): void {
    let topValue: Window, parentValue: Window
    const rawWindow = globalEnv.rawWindow
    if (rawWindow === rawWindow.parent) { // not in iframe
      topValue = parentValue = this.proxyWindow
    } else { // in iframe
      topValue = rawWindow.top
      parentValue = rawWindow.parent
    }

    rawDefineProperty(
      microAppWindow,
      'top',
      this.createDescriptorFormicroAppWindow('top', topValue)
    )

    rawDefineProperty(
      microAppWindow,
      'parent',
      this.createDescriptorFormicroAppWindow('parent', parentValue)
    )

    globalPropertyList.forEach((key: PropertyKey) => {
      rawDefineProperty(
        microAppWindow,
        key,
        this.createDescriptorFormicroAppWindow(key, this.proxyWindow)
      )
    })
  }

  private createDescriptorFormicroAppWindow (key: PropertyKey, value: unknown): PropertyDescriptor {
    const { configurable = true, enumerable = true, writable, set } = Object.getOwnPropertyDescriptor(globalEnv.rawWindow, key) || {}
    const descriptor: PropertyDescriptor = {
      value,
      configurable,
      enumerable,
      writable: writable ?? !!set
    }

    return descriptor
  }

  // set hijack Properties to microAppWindow
  private setHijackProperties (microAppWindow: microAppWindowType, appName: string): void {
    let modifiedEval: unknown, modifiedImage: unknown
    rawDefineProperties(microAppWindow, {
      document: {
        get () {
          throttleDeferForSetAppName(appName)
          return globalEnv.rawDocument
        },
        configurable: false,
        enumerable: true,
      },
      eval: {
        get () {
          throttleDeferForSetAppName(appName)
          return modifiedEval || eval
        },
        set (value) {
          modifiedEval = value
        },
        configurable: true,
        enumerable: false,
      },
      Image: {
        get () {
          throttleDeferForSetAppName(appName)
          return modifiedImage || globalEnv.ImageProxy
        },
        set (value) {
          modifiedImage = value
        },
        configurable: true,
        enumerable: false,
      },
    })
  }
}
