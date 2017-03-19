import React, { Component } from 'react';
import { ScatterChart, ComposedChart, Bar, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

import * as main from '../lib/main';

import * as utils from '../lib/utils';

import Histogram from '../components/histogram';

const arrivalD = utils.expD(main.Ma);
const processingD = utils.erlangD(main.k, main.Ms);


let reqArrivalTime = main.getReqArrivalTime();
let reqProcessingTime = main.getReqProcessingTime();

let evalMa = utils.getMu(reqArrivalTime);
let evalDa = utils.getD(reqArrivalTime, evalMa);
// console.log('Оценка мат ожидания СВ времени поступления требований: ', evalMa);
// console.log('Оценка дисперсии СВ времени поступления требований: ', evalDa);

let arrivalNextPrev = utils.getNextFromPrevData(reqArrivalTime, evalDa);
let processingNextPrev = utils.getNextFromPrevData(reqProcessingTime, evalDa);

let evalMs = utils.getMu(reqProcessingTime);
let evalDs = utils.getD(reqProcessingTime, evalMs);
// console.log('Оценка мат ожидания СВ времени обработки требований: ', evalMs);
// console.log('Оценка дисперсии СВ времени обработки требований: ', evalDs);

let arrivalCorr = utils.getCorrData(20, reqArrivalTime, evalMa, evalDa);
let processingCorr = utils.getCorrData(20, reqProcessingTime, evalMs, evalDs);

let arrivalConfInt = utils.getConfInterval(evalMa, evalDa, reqArrivalTime.length, main.Ma);
let processingConfInt = utils.getConfInterval(evalMs, evalDs, reqProcessingTime.length, main.Ms);

let arrivalSignificance = utils.getSignificance(evalMa, evalDa, reqArrivalTime.length, main.Ma);
let processingSignificance = utils.getSignificance(evalMs, evalDs, reqProcessingTime.length, main.Ms);

let arrivalZ = utils.chiSquareTest(reqArrivalTime, {
  fn: utils.expPDF,
  args: {
    mean: main.Ma,
    D: arrivalD
  }
});
let processingZ = utils.chiSquareTest(reqProcessingTime, {
  fn: utils.erlangPDF,
  args: {
    mean: main.Ms,
    D: processingD,
    k: main.k
  }
});

let priority = main.getArrivalPriority();

let evalPriorityM = utils.getMu(priority);
let evalPriorityD = utils.getD(priority, evalPriorityM);

let priorityNextPrev = utils.getNextFromPrevData(priority, evalPriorityD);

let priorityCorr = utils.getCorrData(20, priority, evalPriorityM, evalPriorityD);

let histData = utils.getGiscreteHist(priority, main.discreteN, {fn: utils.expPDF, args: {mean: main.discreteM}});

const SimpleScatterChart = React.createClass({
  render () {
    return (
      <ScatterChart width={600} height={600}>
        <XAxis dataKey={'x'} name='stature' unit='sec'/>
        <YAxis dataKey={'y'} name='weight' unit='sec'/>
        <ZAxis dataKey={'z'} range={this.props.range ? [this.props.range, this.props.range] : [4, 4]} />
        <Scatter name='Next from prev' data={this.props.data} fill='#8884d8'/>
        <CartesianGrid stroke='#f5f5f5' />
        <Tooltip cursor={{strokeDasharray: '3 3'}}/>
      </ScatterChart>
    );
  }
});

const LineBarAreaComposedChart = React.createClass({
  render () {
    return (
      <ComposedChart width={600} height={600} data={this.props.data}>
        <XAxis dataKey={'x'} name='stature' unit='sec'/>
        <YAxis dataKey={'y'} name='weight' unit='sec'/>
        <ZAxis dataKey={'z'} range={this.props.range ? [this.props.range, this.props.range] : [4, 4]} />
        <Tooltip/>
        <Legend/>
        <CartesianGrid stroke='#f5f5f5'/>
        <Bar name="PDF" dataKey='y' barSize={4} fill='orangered'/>
        <Bar name="Эмпирические значения" dataKey='l' barSize={4} fill='#8884d8'/>
      </ComposedChart>
    );
  }
});

class Analysis extends Component {
  render() {
    return (
      <div className="container">
        <div className="req-container">
          <h2>Время поступления требований</h2>
          <div className="content-container">
            <p>Оценка мат. ожидания: {evalMa.toFixed(2)}</p>
            <p>Оценка дисперсии: {evalDa.toFixed(2)}</p>
          </div>
          <div className="content-container">
            <SimpleScatterChart data={arrivalNextPrev} />
            <p className="plot-name">Рисунок — Диаграмма разброса (X<sub>i</sub>, X<sub>i+1</sub>)</p>
          </div>
          <div className="content-container">
            <SimpleScatterChart data={arrivalCorr} range={15} />
            <p className="plot-name">Рисунок — График коэффициента корреляции (i, p(i))</p>
          </div>
          <div className="content-container">
            <p>Ma = {main.Ma} {arrivalConfInt[0] <= main.Ma && arrivalConfInt[1] >= main.Ma ? `Попадает` : `Не попадает`} в доверительный интервал</p>
            <p>{`${arrivalConfInt[0].toFixed(2)} <= Ma <= ${arrivalConfInt[1].toFixed(2)}`}</p>
          </div>
          <div className="content-container">
            <p>Проверка гипотезы доверительного интервала {arrivalSignificance < main.t ? 'принимается' : 'отвергается'}:</p>
            <p>|Z| = {arrivalSignificance.toFixed(2)} {arrivalSignificance.toFixed(2) < main.t ? '<' : '>='} t = {main.t}</p>
          </div>
          <div className="content-container">
            <Histogram data={reqArrivalTime} width={600} height={600} options={ {color: '#413ea0', line: {fn: utils.expPDF, args: {mean: main.Ma}}} } />
            <p className="plot-name">Рисунок — Гистограммма и графико плотности вероятности</p>
          </div>
          <div className="content-container">
            <p>Провека гипотезы о законе распределения методом χ<sup>2</sup> {arrivalZ < main.quantille ? 'принимается' : 'отвергается'}:</p>
            <p>Z = {arrivalZ.toFixed(2)} {arrivalZ < main.quantille ? '<' : '>='} χ<sup>2</sup><sub>16, 0.95</sub> = {main.quantille}</p>
          </div>
        </div>
        <div className="req-container">
          <h2>Время обработки требований</h2>
          <div className="content-container">
            <p>Оценка мат. ожидания: {evalMs.toFixed(2)}</p>
            <p>Оценка дисперсии: {evalDs.toFixed(2)}</p>
          </div>
          <div className="content-container">
            <SimpleScatterChart data={processingNextPrev} />
            <p className="plot-name">Рисунок — Диаграмма разброса (X<sub>i</sub>, X<sub>i+1</sub>)</p>
          </div>
          <div className="content-container">
            <SimpleScatterChart data={processingCorr} range={15} />
            <p className="plot-name">Рисунок — График коэффициента корреляции (i, p(i))</p>
          </div>
          <div className="content-container">
            <p>Ms = {main.Ms} {processingConfInt[0] <= main.Ms && processingConfInt[1] >= main.Ms ? `Попадает` : `Не попадает`} в доверительный интервал</p>
            <p>{`${processingConfInt[0].toFixed(2)} <= Ms <= ${processingConfInt[1].toFixed(2)}`}</p>
          </div>
          <div className="content-container">
            <p>Гипотеза H0 {processingSignificance < main.t ? 'принимается' : 'отвергается'}:</p>
            <p>|Z| = {processingSignificance.toFixed(2)} {processingSignificance.toFixed(2) < main.t ? '<' : '>='} t = {main.t}</p>
          </div>
          <div className="content-container">
            <Histogram data={reqProcessingTime} width={600} height={600} options={ {color: '#413ea0', line: {fn: utils.erlangPDF, args: {k: main.k, mean: main.Ms}}} } />
            <p className="plot-name">Рисунок — Гистограммма и графико плотности вероятности</p>
          </div>
          <div className="content-container">
            <p>Провека гипотезы о законе распределения методом χ<sup>2</sup> {processingZ < main.quantille ? 'принимается' : 'отвергается'}:</p>
            <p>Z = {processingZ.toFixed(2)} {processingZ < main.quantille ? '<' : '>='} χ<sup>2</sup><sub>16, 0.95</sub> = {main.quantille}</p>
          </div>
        </div>
        <div className="priority-container">
          <h2>Приоритет</h2>
          <div className="content-container">
            <p>Оценка мат. ожидания: {evalPriorityM.toFixed(2)}</p>
            <p>Оценка дисперсии: {evalPriorityD.toFixed(2)}</p>
          </div>
          <div className="content-container">
            <SimpleScatterChart data={priorityNextPrev} />
            <p className="plot-name">Рисунок — Диаграмма разброса (X<sub>i</sub>, X<sub>i+1</sub>)</p>
          </div>
          <div className="content-container">
            <SimpleScatterChart data={priorityCorr} range={15} />
            <p className="plot-name">Рисунок — График коэффициента корреляции (i, p(i))</p>
          </div>
          <div className="content-container">
            <LineBarAreaComposedChart data={histData} />
            <p className="plot-name">Рисунок — Гистограммма и графико плотности вероятности</p>
            {/*<Histogram data={priority} width={600} height={600} options={ {k: 5, mode: 'stem', color: '#413ea0', line: {fn: utils.normPDF, args: {mean: main.discreteM, D: main.discreteD}}} } />*/}
          </div>
        </div>
      </div>
    );
  }
}

export default Analysis;