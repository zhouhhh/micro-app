import React from 'react'
import logo from '../../assets/logo.svg';
import { Modal, Button, Space } from 'antd';
import './page1.css';

function getDataFromBase () {
  Modal.info({
    title: '主动获取数据',
    content: (
      <div>
        <p>来自基座的数据 {JSON.stringify(window.microApp?.getData() ?? '')}</p>
      </div>
    ),
    onOk() {},
  });
}

function Page1() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          React@{React.version}
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <div className='test-b'>111122</div>
      </header>
      <div>
        {
          window.location.href.includes('react16') && (
            <div className='btn-con2' clstag="pageclick|keycount|home2013|08a">
              <Space direction='vertical'>
                <Button type="primary" onClick={() => window.microApp?.dispatch({'from': '来自微应用react16的数据' + (+new Date())})}>
                  向基座应用发送数据
                </Button>
                <Button type="primary" onClick={getDataFromBase}>
                  主动获取数据
                </Button>
              </Space>
            </div>
          )
        }
      </div>
    </div>
  );
}

export default Page1;
