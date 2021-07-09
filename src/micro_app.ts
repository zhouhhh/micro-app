import type { OptionsType, MicroAppConfigType, lifeCyclesType, plugins, fetchType } from '@micro-app/types'
import { defineElement } from './micro_app_element'
import preFetch from './prefetch'
import { formatLogMessage, isFunction } from './libs/utils'
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
      return console.error(formatLogMessage('customElements is not supported in this environment'))
    }

    if (options?.tagName) {
      if (/^micro-app(-\S+)?/.test(options.tagName)) {
        this.tagName = options.tagName
      } else {
        return console.error(formatLogMessage(`${options.tagName} is invalid tagName`))
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

      if (options.preFetchApps) {
        preFetch(options.preFetchApps)
      }
    }
  }
}

export default new MicroApp()
