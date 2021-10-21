import { createApp } from 'vue'
import * as VueRouter from 'vue-router'
import App from './App.vue'
import Page1 from './pages/page1.vue'
import Page2 from './pages/page2.vue'

const routes = [
  { path: '/', component: Page1 },
  { path: '/page2', component: Page2 },
]

// const router = VueRouter.createRouter({
//   history: VueRouter.createWebHashHistory('/micro-app/vite/'),
//   routes,
// })

// const app = createApp(App)
// app.use(router)
// app.mount('#vite-app')


let app = null
let router = null
let history = null
// 将渲染操作放入 mount 函数
function mount () {
  history = VueRouter.createWebHashHistory('/micro-app/vite/')
  router = VueRouter.createRouter({
    history,
    routes,
  })

  app = createApp(App)
  app.use(router)
  app.mount('#vite-app')

  console.log('微应用child-vite渲染了')
}

// 将卸载操作放入 unmount 函数
function unmount () {
  app.unmount()
  history.destroy()
  app = null
  router = null
  history = null
  console.log('微应用child-vite卸载了')
}

// 微前端环境下，注册mount和unmount方法
if (window.__MICRO_APP_BASE_APPLICATION__) {
  window['micro-app-vite'] = { mount, unmount }
} else {
  // 非微前端环境直接渲染
  mount()
}
