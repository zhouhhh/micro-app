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

// ReactDOM.render(
//   <React.StrictMode>
//     <Router />
//   </React.StrictMode>,
//   document.getElementById("root")
// );

// // 监听卸载
// window.addEventListener("unmount", function () {
//   // microApp.clearApps()
//   console.log("微应用react16卸载了");
//   // 卸载前卸载全局数据监听
//   // window.microApp?.removeGlobalDataListener(handleGlobalData);
//   // 卸载应用
//   ReactDOM.unmountComponentAtNode(document.getElementById("root"));
// })


export function mount () {
  ReactDOM.render(
    <React.StrictMode>
      <Router />
    </React.StrictMode>,
    document.getElementById("root")
  );
  console.timeEnd("react16");
}

export function unmount () {
  console.log("微应用react16卸载了 -- 来自umd-unmount");
  // 卸载应用
  ReactDOM.unmountComponentAtNode(document.getElementById("root"));
}

// 非微前端环境直接运行
if (!window.__MICRO_APP_ENVIRONMENT__) {
  mount()
}

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
