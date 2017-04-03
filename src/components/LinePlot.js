import React, {Component} from 'react';
import { ComposedChart, XAxis, YAxis, Legend, CartesianGrid, Line } from 'recharts';

export function transformData(x, y) {
  if (x.length !== y.length) {
    console.error("Data for transformation have different sizes");
  }
  return x.map((val, i) => ({
    x: val,
    y: y[i],
  }))
}

export default class LinePlot extends Component {
  render() {
    const { width, height, x, y } = this.props;
    return (
      <ComposedChart width={width} height={height} data={transformData(x, y)}>
        <XAxis dataKey='x' type='number'/>
        <YAxis dataKey='y'/>
        <Legend />
        <CartesianGrid stroke="#f5f5f5" />
        <Line dot={false} isAnimationActive={false} dataKey="y" stroke="#8884d8" />
      </ComposedChart>
    )
  }
}