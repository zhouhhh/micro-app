/* eslint-disable no-return-assign */
import { isBoundFunction, rawDefineProperty, isBoolean } from '../libs/utils'

function isBoundedFunction (value: CallableFunction & {__MICRO_APP_ISBOUND_FUNCTION: boolean}): boolean {
  if (isBoolean(value.__MICRO_APP_ISBOUND_FUNCTION)) return value.__MICRO_APP_ISBOUND_FUNCTION
  return value.__MICRO_APP_ISBOUND_FUNCTION = isBoundFunction(value)
}

function isConstructor (value: FunctionConstructor & {__MICRO_APP_ISCONSTRUCTOR: boolean}) {
  if (isBoolean(value.__MICRO_APP_ISCONSTRUCTOR)) return value.__MICRO_APP_ISCONSTRUCTOR

  const valueStr = value.toString()

  const result = (
    value.prototype?.constructor === value &&
    Object.getOwnPropertyNames(value.prototype).length > 1
  ) ||
    /^function\s+[A-Z]/.test(valueStr) ||
    /^class\s+/.test(valueStr)

  return value.__MICRO_APP_ISCONSTRUCTOR = result
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function bindFunctionToRawWindow (rawWindow: Window, value: any): unknown {
  if (value.__MICRO_APP_BOUND_WINDOW_FUNCTION) return value.__MICRO_APP_BOUND_WINDOW_FUNCTION

  if (!isConstructor(value) && !isBoundedFunction(value)) {
    const bindRawWindowValue = value.bind(rawWindow)

    for (const key in value) {
      bindRawWindowValue[key] = value[key]
    }

    if (value.hasOwnProperty('prototype')) {
      rawDefineProperty(bindRawWindowValue, 'prototype', {
        value: value.prototype,
        configurable: true,
        enumerable: false,
        writable: true,
      })
    }

    return value.__MICRO_APP_BOUND_WINDOW_FUNCTION = bindRawWindowValue
  }

  return value
}
