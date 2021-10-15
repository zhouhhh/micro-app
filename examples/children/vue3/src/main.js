import './public-path'
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/lib/theme-chalk/index.css'
import router from './router'
import App from './App.vue'

// const app = createApp(App)
// app.use(ElementPlus)
// app.use(router)
// app.mount('#app')

// console.log('微应用vue3渲染了')

// // 监听卸载
// window.addEventListener('unmount', function () {
//   console.log('微应用vue3卸载了')
//   // 卸载应用
//   app.unmount()
// })

let app = null
// 将渲染操作放入 mount 函数
function mount () {
  app = createApp(App)
  app.use(ElementPlus)
  app.use(router)
  app.mount('#app')

  console.log('微应用child-vue3渲染了')
}

// 将卸载操作放入 unmount 函数
function unmount () {
  app.unmount()
  app = null
  console.log('微应用child-vue3卸载了')
}

// 微前端环境下，注册mount和unmount方法
if (window.__MICRO_APP_ENVIRONMENT__) {
  // @ts-ignore
  window[`micro-app-${window.__MICRO_APP_NAME__}`] = { mount, unmount }
} else {
  // 非微前端环境直接渲染
  mount()
}
