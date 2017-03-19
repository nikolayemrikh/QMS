/* eslint-disable */
import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

import Analysis from './components/generatorsAnalysis';
import SMO from './components/SMO';

import * as main from './lib/main';

let items = [{
  name: 'Analysis',
  component: Analysis,
  selected: false
}, {
  name: 'SMO',
  component: SMO,
  selected: true
}];

class App extends Component {
  constructor(props) {
    super(props);

    // This binding is necessary to make `this` work in the callback
    this.handleClick = this.handleClick.bind(this);
  }
  handleClick(e) {
    e.preventDefault();
    console.log('The link was clicked.');
  }
  render() {
    return (
      <SMO />
    );
  }
}
      {/*<div className="main-select">|*/}
        {/*<label> Выберите что будем делать*/}
          {/*<select defaultValue="SMO">*/}
            {/*{items.map(item => {*/}
                {/*return <option onChange={this.handleClick} key={item.name} value={item.name}>{item.name}</option>;*/}
            {/*})}*/}
          {/*</select>*/}
        {/*</label>*/}
      {/*</div>*/}
export default App;
