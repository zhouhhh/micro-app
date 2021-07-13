import "./public-path";
import 'babel-polyfill'
// import '@babel/polyfill'
import React from "react";
import ReactDOM from "react-dom";
import "antd/dist/antd.css";
import "./index.css";
import Router from "./router";
import { Modal, notification } from "antd";
import microApp from '@micro-zoe/micro-app'
// import reportWebVitals from './reportWebVitals';

// 循环内嵌
microApp.start({
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
  Modal.info({
    title: "来全局数据",
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

ReactDOM.render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
  document.getElementById("root")
);

// 监听卸载
window.addEventListener("unmount", function () {
  // microApp.clearApps()
  console.log("微应用react16卸载了");
  // 卸载前卸载全局数据监听
  window.microApp?.removeGlobalDataListener(handleGlobalData);
  // 卸载应用
  ReactDOM.unmountComponentAtNode(document.getElementById("root"));
})

console.timeEnd("react16");
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();

// <link rel="stylesheet" href="http://localhost:8080/test.css">

// const slink = document.createElement('link')
// slink.setAttribute('rel', "stylesheet")
// slink.setAttribute('href', "http://localhost:8080/test.css")

// document.head.appendChild(slink)

// setTimeout(() => {
//   const dom = document.createElement('script')
//   dom.setAttribute('src', "http://localhost:8080/test.js")
//   delete dom._MICRO_APP_NAME_
//   document.body.appendChild(dom)
// }, 3000);

setTimeout(() => {
  // debugger
  window.log?.("ept_en_pc", "item_addcard", 650571384, "us", 15.2, 1);
}, 10000);

document.addEventListener('click', function () {
  console.log(`子应用${window.__MICRO_APP_NAME__}内部的document.addEventListener(click)绑定`)
}, false)

// var p1 = document.createElement("p");
// p1.innerText = 'p1p1p1'
// document.querySelectorAll('head')[0].prepend("Some text", p1);

// var p2 = document.createElement("p");
// p2.innerText = '22222'
// document.querySelectorAll('body')[0].append("11111", p2);
