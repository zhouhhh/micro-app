import Vue from 'vue'
import VueRouter from 'vue-router'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import microApp from '@micro-zoe/micro-app'
import routes from './router'
import App from './App.vue'

// microApp.preFetch([{name: 'react16', url: 'http://localhost:3001/'}])

microApp.start({
  lifeCycles: {
    created () {
      console.log('created 全局监听')
    },
    beforemount () {
      console.log('beforemount 全局监听')
    },
    mounted () {
      console.log('mounted 全局监听')
    },
    unmount () {
      console.log('unmount 全局监听')
    },
    error () {
      console.log('error 全局监听')
    }
  },
  plugins: {
    modules: {
      react16: [{
        loader(code, url) {
          if (code.indexOf('sockjs-node') > -1) {
            console.log('react16插件', url)
            code = code.replace('window.location.port', '3001')
          }
          return code
        }
      }],
      react162: [{
        loader(code, url) {
          if (code.indexOf('sockjs-node') > -1) {
            console.log('react16插件', url)
            code = code.replace('window.location.port', '3001')
          }
          return code
        }
      }],
      react17: [{
        loader(code, url) {
          if (code.indexOf('sockjs-node') > -1) {
            console.log('react17插件', url)
            code = code.replace('window.location.port', '3002')
          }
          return code
        }
      }],
    }
  },
  /**
   * 自定义fetch
   * @param url 静态资源地址
   * @param options fetch请求配置项
   * @returns Promise<string>
  */
   fetch (url, options, appName) {
    return fetch(url, options).then((res) => {
      return res.text()
    }).then((text) => {
      // 兼容vite
      if (process.env.NODE_ENV === 'development' && appName === 'vite') {
        text = text.replace(/(from|import)(\s*['"])(\/micro-app\/vite\/)/g, (all) => {
          return all.replace('/micro-app/vite/', 'http://localhost:7001/micro-app/vite/')
        })

        text = text.replace('customElements.define(overlayId, ErrorOverlay);', '')
      }

      return text
    })
  }
})

Vue.config.productionTip = false
Vue.use(ElementUI)

const router = new VueRouter({
  // options: {
  //   base: '/micro-app/demo/',
  // },
  mode: 'history',
  routes,
})

new Vue({
  router,
  render: h => h(App),
}).$mount('#app')
