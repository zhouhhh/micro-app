import type { microWindowType, SandBoxInterface } from '@micro-app/types'
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
  // Scoped global Properties(Properties that can only get and set in microWindow, will not escape to rawWindow)
  private scopeProperties: PropertyKey[] = ['webpackJsonp']
  // Properties that can be escape to rawWindow
  private escapeProperties: PropertyKey[] = []
  // Properties newly added to microWindow
  private injectedKeys = new Set<PropertyKey>()
  // Properties escape to rawWindow, cleared when unmount
  private escapeKeys = new Set<PropertyKey>()
  // record injected values before the first execution of umdHookMount and rebuild before remount umd app
  private recordUmdinjectedValues?: Map<PropertyKey, unknown>
  // sandbox state
  private active = false
  proxyWindow: WindowProxy // Proxy
  microWindow = {} as MicroAppWindowType // Proxy target

  constructor (appName: string, url: string) {
    const rawWindow = globalEnv.rawWindow
    // get scopeProperties and escapeProperties from plugins
    this.getScopeProperties(appName)
    // Rewrite global event listener & timeout
    Object.assign(this, effect(this.microWindow))

    // window.xxx will trigger proxy
    this.proxyWindow = new Proxy(this.microWindow, {
      get: (target: microWindowType, key: PropertyKey): unknown => {
        // faster than defineProperty to microWindow
        if (globalPropertyList.includes(key)) return this.proxyWindow

        if (
          Reflect.has(target, key) ||
          (isString(key) && /^__MICRO_APP_/.test(key)) ||
          this.scopeProperties.includes(key)
        ) return Reflect.get(target, key)

        const rawValue = Reflect.get(rawWindow, key)

        return bindFunctionToRawWindow(rawWindow, rawValue)
      },
      set: (target: microWindowType, key: PropertyKey, value: unknown): boolean => {
        if (this.active) {
          if (escapeSetterKeyList.includes(key)) {
            Reflect.set(rawWindow, key, value)
          } else if (
            !target.hasOwnProperty(key) &&
            rawWindow.hasOwnProperty(key) &&
            !this.scopeProperties.includes(key)
          ) {
            const descriptor = Object.getOwnPropertyDescriptor(rawWindow, key)
            const { writable, configurable, enumerable } = descriptor!
            if (writable) {
              rawDefineProperty(target, key, {
                configurable,
                enumerable,
                writable,
                value,
              })
              this.injectedKeys.add(key)
            }
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
      has: (target: microWindowType, key: PropertyKey): boolean => {
        if (this.scopeProperties.includes(key)) return key in target
        return key in target || key in rawWindow
      },
      // Object.getOwnPropertyDescriptor(window, key)
      getOwnPropertyDescriptor: (target: microWindowType, key: PropertyKey): PropertyDescriptor|undefined => {
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
      ownKeys: (target: microWindowType): Array<string | symbol> => {
        return unique(Reflect.ownKeys(rawWindow).concat(Reflect.ownKeys(target)))
      },
      deleteProperty: (target: microWindowType, key: PropertyKey): boolean => {
        if (target.hasOwnProperty(key)) {
          this.injectedKeys.has(key) && this.injectedKeys.delete(key)
          this.escapeKeys.has(key) && Reflect.deleteProperty(rawWindow, key)
          return Reflect.deleteProperty(target, key)
        }
        return true
      },
    })

    // inject global properties
    this.initMicroWindow(this.microWindow, appName, url)
  }

  start (baseroute: string): void {
    if (!this.active) {
      this.active = true
      this.microWindow.__MICRO_APP_BASE_ROUTE__ = this.microWindow.__MICRO_APP_BASE_URL__ = baseroute
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
      this.microWindow.microApp.clearDataListener()
      this.microWindow.microApp.clearGlobalDataListener()

      this.injectedKeys.forEach((key: PropertyKey) => {
        Reflect.deleteProperty(this.microWindow, key)
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
    this.microWindow.__MICRO_APP_UMD_MODE__ = true
    this.recordUmdEffect()
    recordDataCenterSnapshot(this.microWindow.microApp)

    this.recordUmdinjectedValues = new Map<PropertyKey, unknown>()
    this.injectedKeys.forEach((key: PropertyKey) => {
      this.recordUmdinjectedValues!.set(key, Reflect.get(this.microWindow, key))
    })
  }

  // rebuild umd snapshot before remount umd app
  rebuildUmdSnapshot (): void {
    this.recordUmdinjectedValues!.forEach((value: unknown, key: PropertyKey) => {
      Reflect.set(this.proxyWindow, key, value)
    })
    this.rebuildUmdEffect()
    rebuildDataCenterSnapshot(this.microWindow.microApp)
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
   * inject global properties to microWindow
   * @param microWindow micro window
   * @param appName app name
   * @param url app url
   */
  private initMicroWindow (microWindow: microWindowType, appName: string, url: string): void {
    microWindow.__MICRO_APP_ENVIRONMENT__ = true
    microWindow.__MICRO_APP_NAME__ = appName
    microWindow.__MICRO_APP_PUBLIC_PATH__ = getEffectivePath(url)
    microWindow.__MICRO_APP_WINDOW__ = microWindow
    microWindow.microApp = new EventCenterForMicroApp(appName)
    microWindow.rawWindow = globalEnv.rawWindow
    microWindow.rawDocument = globalEnv.rawDocument
    microWindow.removeDomScope = removeDomScope
    microWindow.hasOwnProperty = (key: PropertyKey) => Object.prototype.hasOwnProperty.call(microWindow, key) || Object.prototype.hasOwnProperty.call(globalEnv.rawWindow, key)
    this.setMappingPropertiesWithRawDescriptor(microWindow)
    this.setHijackProperties(microWindow, appName)
  }

  // properties associated with the native window
  private setMappingPropertiesWithRawDescriptor (microWindow: microWindowType) {
    let topValue: Window, parentValue: Window
    const rawWindow = globalEnv.rawWindow
    if (rawWindow === rawWindow.parent) { // not in iframe
      topValue = parentValue = this.proxyWindow
    } else { // in iframe
      topValue = rawWindow.top
      parentValue = rawWindow.parent
    }

    rawDefineProperty(
      microWindow,
      'top',
      this.createDescriptorForMicroWindow('top', topValue)
    )

    rawDefineProperty(
      microWindow,
      'parent',
      this.createDescriptorForMicroWindow('parent', parentValue)
    )
  }

  private createDescriptorForMicroWindow (key: PropertyKey, value: unknown): PropertyDescriptor {
    const { configurable, enumerable, writable, set } = Object.getOwnPropertyDescriptor(globalEnv.rawWindow, key) || {}
    const descriptor: PropertyDescriptor = {
      value,
      configurable,
      enumerable,
    }

    if (writable || set) {
      descriptor.writable = true
    }

    return descriptor
  }

  // set hijack Properties to microWindow
  private setHijackProperties (microWindow: microWindowType, appName: string) {
    let modifiedEval: unknown, modifiedImage: unknown
    rawDefineProperties(microWindow, {
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
