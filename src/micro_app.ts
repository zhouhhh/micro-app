import type { OptionsType, MicroAppConfigType, lifeCyclesType, plugins, fetchType } from '@micro-app/types'
import { defineElement } from './micro_app_element'
import preFetch, { getGlobalAssets } from './prefetch'
import { logError, isFunction } from './libs/utils'
import { EventCenterForBaseApp } from './interact'

class MicroApp extends EventCenterForBaseApp implements MicroAppConfigType {
  tagName = 'micro-app'
  shadowDOM?: boolean
  destory?: boolean
  inline?: boolean
  disableScopecss?: boolean
  disableSandbox?: boolean
  macro?: boolean
  lifeCycles?: lifeCyclesType
  plugins?: plugins
  fetch?: fetchType
  preFetch = preFetch
  start (options?: OptionsType) {
    if (!window?.customElements) {
      return logError('customElements is not supported in this environment')
    }

    if (options?.tagName) {
      if (/^micro-app(-\S+)?/.test(options.tagName)) {
        this.tagName = options.tagName
      } else {
        return logError(`${options.tagName} is invalid tagName`)
      }
    }

    if (defineElement(this.tagName) && options && toString.call(options) === '[object Object]') {
      this.shadowDOM = options.shadowDOM
      this.destory = options.destory
      this.inline = options.inline
      this.disableScopecss = options.disableScopecss
      this.disableSandbox = options.disableSandbox
      this.macro = options.macro
      if (isFunction(options.fetch)) this.fetch = options.fetch

      if (toString.call(options.lifeCycles) === '[object Object]') {
        this.lifeCycles = options.lifeCycles
      }

      if (toString.call(options.plugins) === '[object Object]') {
        this.plugins = options.plugins
      }

      // load app assets when browser is idle
      if (options.preFetchApps) {
        preFetch(options.preFetchApps)
      }

      // load global assets when browser is idle
      if (options.globalAssets) {
        getGlobalAssets(options.globalAssets)
      }
    }
  }
}

export default new MicroApp()
