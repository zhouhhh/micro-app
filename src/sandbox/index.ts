import type { SandBoxInterface, microWindowType } from '@micro-app/types'
import bindFunctionToRawWidow from './bind_function'
import {
  unique,
  setCurrentAppName,
  defer,
  getEffectivePath,
  removeDomScope,
  isString,
  isPlainObject,
  isArray,
} from '../libs/utils'
import effect, { effectDocumentEvent, releaseEffectDocumentEvent } from './effect'
import {
  EventCenterForMicroApp,
  recordDataCenterSnapshot,
  rebuildDataCenterSnapshot,
} from '../interact'
import microApp from '../micro_app'
import globalEnv from '../libs/global_env'

/* eslint-disable camelcase */
type injectDataType = {
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

// Variables that can escape to rawWindow
const staticEscapeProperties: PropertyKey[] = [
  'System',
  '__cjsWrapper',
  '__REACT_ERROR_OVERLAY_GLOBAL_HOOK__',
]

// Variables that can only assigned to rawWindow
const escapeSetterKeyList: PropertyKey[] = [
  'location',
]

const unscopables = {
  undefined: true,
  Array: true,
  Object: true,
  String: true,
  Boolean: true,
  Math: true,
  Number: true,
  Symbol: true,
  parseFloat: true,
  Float32Array: true,
}

/**
 * macro task to solve the rendering problem of vue3
 */
let macroTimer: number
function macroTask (fn: TimerHandler): void {
  if (macroTimer) clearTimeout(macroTimer)
  macroTimer = setTimeout(fn, 0)
}

export default class SandBox implements SandBoxInterface {
  static activeCount = 0 // number of active sandbox
  active = false // sandbox state
  proxyWindow: WindowProxy & injectDataType
  // @ts-ignore
  recordUmdEffect: CallableFunction
  // @ts-ignore
  rebuildUmdEffect: CallableFunction
  // @ts-ignore
  releaseEffect: CallableFunction
  // Scoped global Properties(Properties that can only get and set in microWindow, will not escape to rawWindow)
  scopeProperties: PropertyKey[] = ['webpackJsonp']
  // Properties that can be escape to rawWindow
  escapeProperties: PropertyKey[] = []
  microWindow = {} as Window & injectDataType // Proxy target
  injectedKeys = new Set<PropertyKey>() // Properties newly added to microWindow
  escapeKeys = new Set<PropertyKey>() // Properties escape to rawWindow, cleared when unmount
  recordUmdinjectedValues?: Map<PropertyKey, unknown>// record injected values before the first execution of umdHookMount and rebuild before remount umd app

  constructor (appName: string, url: string, macro: boolean) {
    const rawWindow = globalEnv.rawWindow
    const rawDocument = globalEnv.rawDocument
    const descriptorTargetMap = new Map<PropertyKey, 'target' | 'rawWindow'>()
    const hasOwnProperty = (key: PropertyKey) => this.microWindow.hasOwnProperty(key) || rawWindow.hasOwnProperty(key)
    // get scopeProperties and escapeProperties from plugins
    this.getScopeProperties(appName)
    // inject global properties
    this.inject(this.microWindow, appName, url)
    // Rewrite global event listener & timeout
    Object.assign(this, effect(this.microWindow))

    this.proxyWindow = new Proxy(this.microWindow, {
      get: (target: microWindowType, key: PropertyKey): unknown => {
        if (key === Symbol.unscopables) return unscopables

        if (['window', 'self', 'globalThis'].includes(key as string)) {
          return this.proxyWindow
        }

        if (key === 'top' || key === 'parent') {
          if (rawWindow === rawWindow.parent) { // not in iframe
            return this.proxyWindow
          }
          return Reflect.get(rawWindow, key) // iframe
        }

        if (key === 'hasOwnProperty') return hasOwnProperty

        if (key === 'document' || key === 'eval') {
          if (this.active) {
            setCurrentAppName(appName)
            ;(macro ? macroTask : defer)(() => setCurrentAppName(null))
          }
          switch (key) {
            case 'document':
              return rawDocument
            case 'eval':
              return eval
          }
        }

        if (Reflect.has(target, key)) {
          return Reflect.get(target, key)
        }

        if (
          this.scopeProperties.includes(key) ||
          (isString(key) && /^__MICRO_APP_/.test(key))
        ) {
          return Reflect.get(target, key)
        }

        const rawValue = Reflect.get(rawWindow, key)

        return bindFunctionToRawWidow(rawWindow, rawValue)
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
              Object.defineProperty(target, key, {
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
        return key in unscopables || key in target || key in rawWindow
      },
      getOwnPropertyDescriptor: (target: microWindowType, key: PropertyKey): PropertyDescriptor|undefined => {
        if (target.hasOwnProperty(key)) {
          descriptorTargetMap.set(key, 'target')
          return Object.getOwnPropertyDescriptor(target, key)
        }

        if (rawWindow.hasOwnProperty(key)) {
          descriptorTargetMap.set(key, 'rawWindow')
          const descriptor = Object.getOwnPropertyDescriptor(rawWindow, key)
          if (descriptor && !descriptor.configurable) {
            descriptor.configurable = true
          }
          return descriptor
        }

        return undefined
      },
      defineProperty: (target: microWindowType, key: PropertyKey, value: PropertyDescriptor): boolean => {
        const from = descriptorTargetMap.get(key)
        if (from === 'rawWindow') {
          return Reflect.defineProperty(rawWindow, key, value)
        }
        return Reflect.defineProperty(target, key, value)
      },
      ownKeys: (target: microWindowType): Array<string | symbol> => {
        return unique(Reflect.ownKeys(rawWindow).concat(Reflect.ownKeys(target)))
      },
      deleteProperty: (target: microWindowType, key: PropertyKey): boolean => {
        if (target.hasOwnProperty(key)) {
          if (this.escapeKeys.has(key)) {
            Reflect.deleteProperty(rawWindow, key)
          }
          return Reflect.deleteProperty(target, key)
        }
        return true
      },
    })
  }

  start (baseroute: string): void {
    if (!this.active) {
      this.active = true
      this.microWindow.__MICRO_APP_BASE_ROUTE__ = this.microWindow.__MICRO_APP_BASE_URL__ = baseroute
      if (globalEnv.rawWindow._babelPolyfill) globalEnv.rawWindow._babelPolyfill = false
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
  getScopeProperties (appName: string): void {
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
  inject (microWindow: microWindowType, appName: string, url: string): void {
    microWindow.__MICRO_APP_ENVIRONMENT__ = true
    microWindow.__MICRO_APP_NAME__ = appName
    microWindow.__MICRO_APP_PUBLIC_PATH__ = getEffectivePath(url)
    microWindow.microApp = new EventCenterForMicroApp(appName)
    microWindow.rawWindow = globalEnv.rawWindow
    microWindow.rawDocument = globalEnv.rawDocument
    microWindow.removeDomScope = removeDomScope
  }
}
