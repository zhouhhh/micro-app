// @ts-ignore
import React from 'react'

type MicroElementType = HTMLElement & Record<string, unknown>

// 生命周期事件
const eventLifeCycles = ['oncreated', 'onbeforemount', 'onmounted', 'onunmount', 'onerror', 'ondatachange']

export default function jsxCustomEvent (
  type: string | CallableFunction,
  props: Record<string, unknown> | null,
  ...children: any[]
): void {
  const newProps = Object.assign({}, props)

  if (/^micro-app(-\S+)?/.test(type as string) && props) {
    // 初始化和卸载、更新时都会执行
    newProps.ref = (element: MicroElementType | null) => {
      if (typeof props.ref === 'function') {
        props.ref(element)
      } else if (typeof props.ref === 'object') {
        (props.ref as any).current = element
      }

      // 卸载和更新时，element为null
      if (element) {
        // 前后数据不同时才更新数据，保持和其它框架(如vue)一致
        if (toString.call(props.data) === '[object Object]' && element.data !== props.data) {
          element.data = props.data
        }

        for (const key in props) {
          if (
            Object.prototype.hasOwnProperty.call(props, key) &&
            eventLifeCycles.includes(key.toLowerCase()) &&
            typeof props[key] === 'function' &&
            (!element[key] || element[key] !== props[key])
          ) {
            const eventName = key.toLowerCase().replace('on', '')
            if (element[key]) {
              // @ts-ignore
              element.removeEventListener(eventName, element[key], false)
            }
            // @ts-ignore
            element.addEventListener(eventName, props[key], false)
            element[key] = props[key]
          }
        }
      }
    }
  }

  return React.createElement.apply(null, [type, newProps, ...children])
}
