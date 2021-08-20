import {createApp} from 'vue'
import App from './App.vue'
import microApp from '@micro-zoe/micro-app'
import {createRouter, createWebHistory} from "vue-router";
import React16 from './pages/react16.vue';
import ElementUI from 'element-plus'
import 'element-plus/lib/theme-chalk/index.css';

const routes = [
  {
    path: '/',
    redirect: '/react16/'
  },
  {
    path: '/react16',
    name: 'react16',
    component: React16,
  },
  {
    path: '/react17',
    name: 'react17',
    component: () => import(/* webpackChunkName: "react17" */ './pages/react17.vue'),
  },
  {
    path: '/vue2',
    name: 'vue2',
    component: () => import(/* webpackChunkName: "vue2" */ './pages/vue2.vue'),
  },
  {
    path: '/vue3',
    name: 'vue3',
    component: () => import(/* webpackChunkName: "vue3" */ './pages/vue3.vue'),
  },
  {
    path: '/vite',
    name: 'vite',
    component: () => import(/* webpackChunkName: "vite" */ './pages/vite.vue'),
  },
  {
    path: '/angular11',
    name: 'angular11',
    component: () => import(/* webpackChunkName: "angular11" */ './pages/angular11.vue'),
  },
  {
    path: '/multiple',
    name: 'multiple',
    component: () => import(/* webpackChunkName: "multiple" */ './pages/multiple.vue'),
  },
  {
    path: '/self',
    name: 'self',
    component: () => import(/* webpackChunkName: "self" */ './pages/self.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL), routes: routes
})

microApp.start({
  lifeCycles: {
    created() {
      console.log('created 全局监听')
    },
    beforemount() {
      console.log('beforemount 全局监听')
    },
    mounted() {
      console.log('mounted 全局监听')
    },
    unmount() {
      console.log('unmount 全局监听')
    },
    error() {
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
      vite: [{
        loader(code) {
          if (process.env.NODE_ENV === 'development') {
            code = code.replace(/(from|import)(\s*['"])(\/micro-app\/vite\/)/g, (all) => {
              return all.replace('/micro-app/vite/', 'http://localhost:7001/micro-app/vite/')
            })
          }
          return code
        }
      }]
    }
  },
  /**
   * 自定义fetch
   * @param url 静态资源地址
   * @param options fetch请求配置项
   * @returns Promise<string>
   */
  fetch(url, options, appName) {
    if (url === 'http://localhost:3001/error.js') {
      return Promise.resolve('')
    }

    let config = null
    if (url === 'http://localhost:3001/micro-app/react16/') {
      config = {
        headers: {
          'custom-head': 'custom-head',
        }
      }
    }

    return fetch(url, Object.assign(options, config)).then((res) => {
      return res.text()
    })
  }
})


createApp(App).use(router).use(ElementUI).mount('#app')
