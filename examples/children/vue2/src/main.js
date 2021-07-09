import './public-path'
import Vue from 'vue'
import VueRouter from 'vue-router'
import routes from './router'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import './my-font/iconfont.css'
import './my-font/iconfont.js' // 引入不同类型iconfont
import App from './App.vue'

Vue.config.productionTip = false
Vue.use(ElementUI)


function getBaseName () {
  // 基座是history路由，子应用是hash路由，不需要设置路由前缀
  return '/'
}

const router = new VueRouter({
  options: {
    base: getBaseName(),
  },
  routes,
})

let app = new Vue({
  router,
  render: h => h(App),
}).$mount('#app')

// 监听卸载
window.addEventListener('unmount', function () {
  console.log('微应用vue2卸载了')
  // 卸载应用
  app.$destroy()
})

console.timeEnd('vue2')
