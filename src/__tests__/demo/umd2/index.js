
function mount () {
  const root = document.querySelector('#root')
  root.innerHTML = `
    <div class='container'>
      <span class='test-color'>text1</span>
      <span class='test-font'>text2</span>
    </div>
  `
}

function unmount () {
  const root = document.querySelector('#root')
  root.innerHTML = ''
}

window['umd-app2'] = { mount, unmount }
