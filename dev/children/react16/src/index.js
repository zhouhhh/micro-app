import "./public-path";
import 'babel-polyfill'
// import '@babel/polyfill'
import React from "react";
import ReactDOM from "react-dom";
import "antd/dist/antd.css";
import "./index.css";
import Router from "./router";
import { Modal, notification } from "antd";
import subMicroApp from '@micro-zoe/micro-app'

// 循环内嵌
subMicroApp.start({
  tagName: 'micro-app-sub'
})

// 数据监听
window.microApp?.addDataListener((data) => {
  console.log("react16 来自基座应用的数据", data)
  notification.open({
    message: "来自基座应用的数据",
    description: JSON.stringify(data),
    duration: 1,
  })
}, true)

function handleGlobalData(data) {
  console.log('react16: 来自全局数据')
  Modal.info({
    title: "react16: 来自全局数据",
    content: (
      <div>
        <p>{JSON.stringify(data)}</p>
      </div>
    ),
    onOk() {},
  });
}

// 全局数据监听
window.microApp?.addGlobalDataListener(handleGlobalData);


// ----------------------分割线-默认模式--------------------- //
ReactDOM.render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
  document.getElementById("root")
);

// 监听卸载
window.addEventListener("unmount", function () {
  ReactDOM.unmountComponentAtNode(document.getElementById("root"));
  console.log("微应用react16卸载了 -- 自定义事件unmount");
})

console.timeEnd("react#16");

// ----------------------分割线-umd模式--------------------- //
// function mount () {
//   ReactDOM.render(
//     <React.StrictMode>
//       <Router />
//     </React.StrictMode>,
//     document.getElementById("root")
//   );
//   console.timeEnd("react16");
// }

// function unmount () {
//   console.log("微应用react16卸载了 -- 来自umd-unmount");
//   // 卸载时关闭弹窗
//   notification.destroy()
//   // 卸载应用
//   ReactDOM.unmountComponentAtNode(document.getElementById("root"));
// }

// // 微前端环境下，注册mount和unmount方法
// if (window.__MICRO_APP_ENVIRONMENT__) {
//   window[`micro-app-${window.__MICRO_APP_NAME__}`] = { mount, unmount }
// } else {
//   // 非微前端环境直接渲染
//   mount();
// }


// ----------------------分割线-特殊场景测试--------------------- //
// document.addEventListener('click', function () {
//   console.log(`子应用${window.__MICRO_APP_NAME__}内部的document.addEventListener(click)绑定`)
// }, false)

// document.onclick = () => {
//   console.log(`子应用${window.__MICRO_APP_NAME__}内部的document.onclick绑定`)
// }

// window.addEventListener('scroll', () => {
//   console.log(`scroll event from ${window.__MICRO_APP_NAME__}`)
// }, false)

// setInterval(() => {
//   console.log(`子应用${window.__MICRO_APP_NAME__}的setInterval`)
// }, 1000)

// const dynamicScript1 = document.createElement('script')
// // dynamicScript1.setAttribute('type', 'module')
// // dynamicScript1.textContent = 'console.warn("inline module")'
// dynamicScript1.setAttribute('src', 'http://127.0.0.1:8080/test.js')
// dynamicScript1.onload = () => {
//   console.log('动态module加载完成了')
// }
// document.body.appendChild(dynamicScript1)

// console.log('__micro_app_environment__', window.__micro_app_environment__)
// console.log('__micro_app_name__', window.__micro_app_name__)
// console.log('__full_public_path__', window.__full_public_path__)
// console.log('baseurl', window.baseurl)

// const dynamicStyle = document.createElement('style')
// document.head.appendChild(dynamicStyle)
// dynamicStyle.textContent = '.test-class { color: red } '


// // BUG TEST: https://github.com/micro-zoe/micro-app/issues/56
// const parser = new DOMParser()
// const htmlString = `
// <div>
//   <span id='parser-id'></span>
//   <span class='parser-class'></span>
//   <i name='parser-name'></i>
// </div>
// `

// const doc = parser.parseFromString(htmlString, "text/html")

// console.log(
//   'DOMParser querySelector',
//   doc.querySelector('#parser-id'),
//   doc.getElementById('parser-id'),
//   doc.querySelectorAll('span'),
//   doc.getElementsByClassName('parser-class'),
//   doc.getElementsByTagName('span'),
//   doc.getElementsByName('parser-name'),
// )

// setTimeout(() => {
//   const d1 = doc.createElement('div')
//   const d2 = doc.createElementNS('http://www.w3.org/1999/xhtml', 'svg')
//   const d3 = doc.createDocumentFragment()

//   console.log('DOMParser createElement', d1, d2, d3)
// }, 3000)

