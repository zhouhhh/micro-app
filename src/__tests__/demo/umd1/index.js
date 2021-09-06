// 动态创建js、css标签
const dynamicStyle = document.createElement('style')
document.head.appendChild(dynamicStyle)
dynamicStyle.textContent = '.test-color { color: green; }'

window.addEventListener('umd-window-event', () => {
  console.warn('umd-window-event is triggered')
}, false)

setTimeout(() => {
  console.warn('setTimeout from umd init env')
}, 1000)

setInterval(() => {
  console.warn('setInterval from umd init env')
}, 1000)

document.addEventListener('click', () => {
  console.warn('click event from umd init env')
})

window.microApp && window.microApp.addDataListener(() => {
  console.warn('scoped data from umd init env')
}, true)

window.microApp && window.microApp.addGlobalDataListener(() => {
  console.warn('scoped globalData from umd init env')
}, true)

// 卸载后，全局变量gd1会被删除，重新渲染后，此值恢复为1
window.gd1 = 1
// 卸载后，逃逸的__cjsWrapper会被删除，重新渲染后，此值恢复
window.__cjsWrapper = '__cjsWrapper'

function mount () {
  const root = document.querySelector('#root')
  root.innerHTML = `
    <div class='container'>
      <span class='test-color'>text1</span>
      <span class='test-font'>text2</span>
    </div>
  `
  // 重写gd1，验证重新渲染后恢复的值为1
  expect(window.gd1).toBe(1)
  expect(window.__cjsWrapper).toBe('__cjsWrapper')
  window.gd1 = 2
  window.gd2 = 2
  window.System = 'System'
}

function unmount () {
  const root = document.querySelector('#root')
  root.innerHTML = ''
}

window['umd-app1'] = { mount, unmount }
