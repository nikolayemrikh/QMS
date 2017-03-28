/* eslint-disable */
import * as generators from '../lib/generators';
import React, { Component } from 'react';
import { ScatterChart, ComposedChart, Bar, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import * as d3 from "d3";
import * as utils from '../lib/utils';
import d3Wrap from 'react-d3-wrap';
import * as main from '../lib/main';
import LinePlot from '../components/LinePlot'

// let RAT = Array.from(reqArrivalTime);
// let RPT = Array.from(reqProcessingTime);
// let PR = Array.from(priority);

// let reqArrivalTime = [0.1, 0.2, 0.15, 0.1, 0.2];
// let reqProcessingTime = [0.5, 0.5, 0.5, 0.8, 1.0];
// let priority = [1, 4, 2, 1, 2];

// let sumProcessingTimeNeeded = reqProcessingTime.reduce((cur, prev) => cur + prev);
function lol(indicators, reqArrivalTime, reqProcessingTime, priority, state) {
  while (indicators.priorQueue.length || indicators.nextPopTime !== false) {
    indicators.prevTime = indicators.currentTime;
  // for (let i = 0; i < 10; ++i) {
    // Время прибытия ближе, чем время выхода
    if (indicators.nextPopTime === null || indicators.nextArrivalTime < indicators.nextPopTime) {
      // console.log('in')
      indicators.currentTime = indicators.nextArrivalTime;
      let nextPriority = priority.shift();
      // Если есть свободное устройство
      let freeAttendantIndex = getFreeAttendantIndex(indicators.attendants);
      if (freeAttendantIndex !== false) {
        indicators.attendants[freeAttendantIndex] = true;
        let procTime = reqProcessingTime.shift();
        indicators.requirementsInProcessing.push({
          attendantIndex: freeAttendantIndex,
          // popTime: indicators.nextPopTime
          popTime: indicators.currentTime + procTime,
          pushedToProcessingTime: indicators.currentTime
        });
        indicators.attendantsBusyTime[freeAttendantIndex].push(procTime);
        // Раз сразу пошло в обработку - значит время ожидания 0
        indicators.waitingTimes.push(0);
      } else { // Если устройства заняты
        let req = {
          priority: nextPriority,
          processingTime: reqProcessingTime.shift(),
          pushedInQueueTime: indicators.currentTime
        };
        if (indicators.priorQueue.length < state.I) {
          // Вставляем в очередь на место, идущее за последним таким же приоритетом либо выше
          const indexToInsert = findIndexToInsert(indicators.priorQueue, nextPriority);
          indicators.priorQueue.splice(indexToInsert, 0, req);
          // Задаем время прибытия след.
        } else { // Очередь полна
          // Нужен ли отказ?
          if (isRefuseNeeded(indicators.priorQueue, nextPriority)) {
            // Отказ нужен
            indicators.rufuseCounter++
          } else {
            // Отказ не нужен для следующего приоритета - значит удаляем первый приоритет из очереди, ибо он меньше того, который пришел
            indicators.priorQueue.shift();
            // Вставляем в очередь на место, идущее за последним таким же приоритетом либо выше
            const indexToInsert = findIndexToInsert(indicators.priorQueue, nextPriority);
            indicators.priorQueue.splice(indexToInsert, 0, req);
          }
        }
      }
      indicators.nextPopTime = getNextPopTime(indicators.requirementsInProcessing, reqProcessingTime);
      indicators.nextArrivalTime = indicators.currentTime + reqArrivalTime.shift();
    } else { // Время выхода ближе
      // console.log('out')
      indicators.currentTime = indicators.nextPopTime;
      // Найдем индекс устройства, из которого сейчас должно выйти требование
      let indexToPop = getIndexFromPopTime(indicators.requirementsInProcessing, indicators.nextPopTime);
      let attIndexToFree = indicators.requirementsInProcessing[indexToPop].attendantIndex;
      // Если в очереди есть требование - засунем его в освободившееся устройство
      if (indicators.priorQueue.length) {
        let reqPopped = indicators.priorQueue.pop();
        let waitingTime = indicators.currentTime - reqPopped.pushedInQueueTime;
        indicators.waitingTimes.push(waitingTime);
        let req = {
          attendantIndex: attIndexToFree,
          popTime: indicators.currentTime + reqPopped.processingTime,
          pushedToProcessingTime: indicators.currentTime
        };
        // Обработанное требование
        let processedReq = indicators.requirementsInProcessing.splice(indexToPop, 1, req)[0];
        // Время, за котоорое это требование обработалось
        let processingTime = indicators.currentTime - processedReq.pushedToProcessingTime;
        indicators.processingTimes.push(processingTime);
        indicators.attendantsBusyTime[attIndexToFree].push(reqPopped.processingTime);

      } else {
        indicators.attendants[attIndexToFree] = null;
        indicators.requirementsInProcessing.splice(indexToPop, 1);
      }
      indicators.nextPopTime = getNextPopTime(indicators.requirementsInProcessing, reqProcessingTime);
    }
    indicators.delay += indicators.prevQueueLength * (indicators.currentTime - indicators.prevTime);
    indicators.prevQueueLength = indicators.priorQueue.length;
    // console.log(indicators, indicators.attendants)
    indicators.lengthInQueue.push(indicators.priorQueue.length)
    indicators.lengthInSystem.push(indicators.priorQueue.length + indicators.requirementsInProcessing.length)
    indicators.avgInQueue.push(getNq(indicators.lengthInQueue, indicators.currentTime));
    indicators.avgInSystem.push(getNs(indicators.lengthInSystem, indicators.currentTime));
    indicators.systemUsageTime.push(getP(indicators.attendantsBusyTime, indicators.currentTime));
  }
  return indicators;
}



const getIndexFromPopTime = (requirementsInProcessing, popTime) => {
  return requirementsInProcessing.findIndex(req => req.popTime === popTime)
};

const getNextPopTime = (requirementsInProcessing, reqPtime) => {
  if (!requirementsInProcessing.length && !reqPtime.length) return false;
  if (!requirementsInProcessing.length) return null;
  let min = Math.min(...requirementsInProcessing.map(req => req.popTime));
  return min;
};

const getFreeAttendantIndex = (attendants) => {
  for (let i = 0, l = attendants.length; i < l; ++i) {
    if (!attendants[i]) return i;
  }
  return false;
};

const isRefuseNeeded = (queue, priority) => {
  let firstPrior = queue[0].priority;
  return priority <= firstPrior;
};

const findIndexToInsert = (queue, priority) => {
  const l = queue.length;
  for (let i = 0; i < l; ++i) {
    let p = queue[i];
    if (p === priority) return i;
    if (p > priority) return i;
  }
  return l;
};

function getInitIndicators(RAT, state) {
  let abt = [];
  console.log(state.S)
  for (let i = 0; i < state.S; ++i) {
    abt.push([]);
  }
  console.log(state.S, new Array(state.S).fill(null))
  let indicators = {
    prevTime: null,
    currentTime: 0,
    nextArrivalTime: RAT.shift(),
    nextPopTime: null,
    priorQueue: [],
    prevQueueLength: 0,
    attendants: new Array(state.S).fill(null),
    requirementsInProcessing: [],
    delay: 0,
    serviceTime: 0,
    attendantsBusyTime: abt,
    rufuseCounter: 0,
    waitingTimes: [],
    processingTimes: [],
    lengthInQueue: [],
    lengthInSystem: [],
    avgInQueue: [],
    avgInSystem: [],
    systemUsageTime: []
  };
  console.log(indicators)
  return indicators;
}
// // Время работы каждого устройства
// console.log(`Время работы каждого устройства: ${indicators.attendantsBusyTime}`);
// // Время работы всех устройств
// console.log(`Время работы всех устройств: ${indicators.attendantsBusyTime.reduce((c, p) => c + p)}`);
// // Время, которое должно было быть затрачено на обработку, если бы не было отказов
// console.log(`Время, которое должно было быть затрачено на обработку, если бы не было отказов: ${sumProcessingTimeNeeded}`);
// // Время задержки
// console.log(`Время задержки требований в очередях: ${indicators.delay}`);
//
// console.log(reqArrivalTime.length, reqProcessingTime.length, priority.length, indicators.rufuseCounter);

const getP = (attendantsBusyTime, modelingTime) => {
  let U = 0;
  for (let i = 0, l = attendantsBusyTime.length; i < l; ++i) {
    let abtcurr = attendantsBusyTime[i];
    if (!abtcurr.length) continue;
    U += abtcurr.reduce((a,b) => a+b) / modelingTime;
  }
  return U / attendantsBusyTime.length;
};

const getMeanTime = (someTimes) => {
  let l = someTimes.length;
  let s = 0;
  for (let i = 0; i < l; ++i) {
    s += someTimes[i];
  }
  return s / l;
};

const getTq = (waitingTimes) => {
  return getMeanTime(waitingTimes);
};

const getTs = (processingTimes) => {
  return getMeanTime(processingTimes);
};

const getNq = (lengthInQueue, modelingTime) => {
  if (!lengthInQueue.length) return 0;
  return lengthInQueue.reduce((a,b) => a+b) / modelingTime;
};

const getNs = (lengthInSystem, modelingTime) => {
  if (!lengthInSystem.length) return 0;
  return lengthInSystem.reduce((a,b) => a+b) / modelingTime;
};

const getCa = (successReqLength, modelingTime) => {
  return successReqLength / modelingTime;
};

const getCr = (successReqLength, n) => {
  return successReqLength / n;
};

let lastResult = {};
let lastInd = {};

function getResult(indicators, state) {
  // console.log(`Время работы каждого устройства: ${indicators.attendantsBusyTime.map(el => el.reduce((a,b) => a+b))}`);
  //
  // let p = getP(indicators.attendantsBusyTime, indicators.currentTime);
  // console.log(`Коэффициент использования системы: ${p}`);
  // let Tq = getTq(indicators.waitingTimes);
  // console.log(`Среднее время ожидания заявки в очереди: ${Tq}`);
  // let Ts = getTs(indicators.processingTimes);
  // console.log(`Среднее время пребывания заявки в системе: ${Ts}`);
  // console.log(`Общее время моделирования: ${indicators.currentTime}`);
  // console.log(`Среднее по времени число требований в очереди: ${getNq(indicators.lengthInQueue, indicators.currentTime)}`);
  // console.log(`Среднее по времени число требований в системе: ${getNs(indicators.lengthInSystem, indicators.currentTime)}`);
  // console.log(`Относительная пропускная способность системы: ${getCa(main.N - indicators.rufuseCounter, indicators.currentTime)}`);
  // console.log(`Абсолютная пропускная способность системы: ${getCr(main.N - indicators.rufuseCounter, main.N)}`);
  let res = [];
  // res.push(indicators.attendantsBusyTime.map(el => el.reduce((a,b) => a+b)));
  res.push(getP(indicators.attendantsBusyTime, indicators.currentTime));
  res.push(getTq(indicators.waitingTimes));
  res.push(getTs(indicators.processingTimes));
  res.push(getNq(indicators.lengthInQueue, indicators.currentTime));
  res.push(getNs(indicators.lengthInSystem, indicators.currentTime));
  res.push(getCa(state.N - indicators.rufuseCounter, indicators.currentTime));
  res.push(getCr(state.N - indicators.rufuseCounter, state.N));
  res.push(indicators.currentTime);
  console.log(indicators)
  lastResult = res;
  lastInd = JSON.parse(JSON.stringify(indicators));
  return res;
}


// let results = [];
// for (let i = 0; i < 10; ++i) {
//   let reqArrivalTime = main.getReqArrivalTime();
//   let reqProcessingTime = main.getReqProcessingTime();
//   let priority = main.getArrivalPriority();
//   let indicators = lol(getInitIndicators(reqArrivalTime), reqArrivalTime, reqProcessingTime, priority);
//   results.push(getResults(indicators));
// }

const getN = (vals) => {

};

class Table extends Component {
  constructor(props) {
    super(props);

  }
  componentWillReceiveProps(props) {
  }
  render() {
    let _self = this;
    return (
      <table className="indicators-table">
        <thead>
          <tr>
            <th>#</th>
            <th>p</th>
            <th>Tq</th>
            <th>Ts</th>
            <th>Nq</th>
            <th>Ns</th>
            <th>Ca</th>
            <th>Cr</th>
            <th>End time</th>
          </tr>
        </thead>
        <tbody>
          {this.props.data.map(function(row, i) {
            return (
              <tr key={i}>
                <td>{i + 1}</td>
                {row.map(function(col, j) {
                  return <td key={j}>{col.toFixed(2)}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
}

function computeProperties(inlres) {
  let mean = inlres.map(arr => {
    return utils.getMu(arr);
  });
  let D = inlres.map((arr, i) => {
    console.log(mean[i], arr)
    return utils.getD(arr, mean[i])
  });
  let E = mean.map(el => el * 0.05);
  let n = [];
  for (let i = 0, l = mean.length; i < l; ++i) {
    n.push((Math.pow(main.t, 2) * D[i]) / Math.pow(E[i], 2));
  }
  return [mean, D, E, n];
}


class ParamsTable extends Component {
  constructor() {
    super();
    this.state = {
      mean: [0, 0, 0, 0, 0, 0, 0, 0],
      D: [0, 0, 0, 0, 0, 0, 0, 0],
      E: [0, 0, 0, 0, 0, 0, 0, 0],
      n: [0, 0, 0, 0, 0, 0, 0, 0],
      inlres: [[], [], [], [], [], [], [], []]
    }
  }
  componentWillReceiveProps(props) {
    var self = this;
    this.state.mean = this.state.mean.map(el => 0);
    let inlres = [[], [], [], [], [], [], [], []];
    for (let i = 0, l = props.data.length; i < l; ++i) {
      let row = props.data[i];
      for (let j = 0, n = row.length; j < n; ++j) {
        let elem = row[j];
        // this.state.mean[j] += elem;
        inlres[j].push(elem);
      }
    }
    this.state.inlres.splice();
    this.setState({inlres: inlres});
    // this.state.mean = this.state.inlres.map(arr => {
    //   return utils.getMu(arr);
    // });
    // this.state.D = this.state.inlres.map((arr, i) => {
    //   console.log(self.state.mean[i])
    //   return utils.getD(arr, self.state.mean[i])
    // });
    let [mean, D, E, n] = computeProperties(inlres);
    this.state.mean = mean;
    this.state.D = D;
    this.state.E = E;
    this.state.n = n;
    console.log(this.state.mean, this.state.D)
  }
  render() {
    let _self = this;
    return (
      <table className="indicators-table">
        <tbody>
          <tr>
            <td>mean<sup>^</sup></td>
            {this.state.mean.map(function (el, i) {
              return <td key={i}>{el.toFixed(3)}</td>;
            })}
          </tr>
          <tr>
            <td>D<sup>^</sup></td>
            {this.state.D.map(function (el, i) {
              return <td key={i}>{el.toFixed(3)}</td>;
            })}
          </tr>
          <tr>
            <td>E</td>
            {this.state.E.map(function (el, i) {
              return <td key={i}>{el.toFixed(3)}</td>;
            })}
          </tr>
          <tr>
            <td>n</td>
            {this.state.n.map(function (el, i) {
              return <td key={i}>{el.toFixed(3)}</td>;
            })}
          </tr>
        </tbody>
      </table>
    );
  }
}

const getTimes = (init = 0, arr, n) => {
  let end = arr[arr.length - 1];
  let delta = (end - init)/n;
  let mas = [];
  for (let i = 0; i < n; ++i) {
    mas.push(delta * i);
  }
  return mas;
};


class SMO extends Component {
  constructor(props) {
    super(props);
    this.state = {
      N: main.N,
      S: main.S,
      I: main.I,
      Ma: main.Ma,
      Ms: main.Ms,
      arrivalSeed: 17147,
      processingSeed: 6773575356,
      prioritySeed: 718882,
      results: [],
      systemPropsSubmitted: false,
      resultsInline: [[], [], [], [], [], [], [], []]
    };

    this.handleChange = this.handleChange.bind(this);
    this.submitSystemProps = this.submitSystemProps.bind(this);
    this.submitGenProps = this.submitGenProps.bind(this);
  }
  setRandomSeeds() {
    // Зададим рандомно начальные значения
    this.setState({arrivalSeed: Math.random() * generators.m});
    this.setState({processingSeed: Math.random() * generators.m});
    this.setState({prioritySeed: Math.random() * generators.m});
  }
  handleChange(event) {
    this.setState({[event.target.name]: event.target.value});
  }
  submitSystemProps(e) {
    e.preventDefault();
    // this.setState({systemPropsSubmitted: true});
  }
  submitGenProps(e) {
    e.preventDefault();
    let reqArrivalTime = main.getReqArrivalTime(this.state.arrivalSeed, this.state);
    let reqProcessingTime = main.getReqProcessingTime(this.state.processingSeed, this.state);
    let priority = main.getArrivalPriority(this.state.prioritySeed, this.state);
    let initIndicators = getInitIndicators(reqArrivalTime, this.state);
    let indicators = lol(initIndicators, reqArrivalTime, reqProcessingTime, priority, this.state);
    lastInd = indicators;
    let results = this.state.results.slice();
    let result = getResult(indicators, this.state);
    results.push(result);
    this.setState({results: results});

    // let resultsInline = this.state.resultsInline.slice();
    // resultsInline = resultsInline.map((el, i) => el.push(result[i]));
    // this.setState({resultsInline: resultsInline});
    // console.log(this.state.resultsInline)
    this.setState({systemPropsSubmitted: true});
    this.setRandomSeeds();
    console.log(lastInd.systemUsageTime.length)
  }
  render() {
    return (
      <div className="container">
        <div>
        <div className="req-container">
          <div className="content-container">
            <h3>Параметры системы</h3>
            <form onSubmit={this.submitSystemProps}>
              <label>
                Количество требований:
                <input type="text" name="N" value={this.state.N} onChange={this.handleChange} />
              </label>
              <label>
                Количество обслуживающих устройств:
                <input type="text" name="S" value={this.state.S} onChange={this.handleChange} />
              </label>
              <label>
                Ёмкость накопителя:
                <input type="text" name="I" value={this.state.I} onChange={this.handleChange} />
              </label>
              <label>
                Среднее время поступления требований:
                <input type="text" name="Ma" value={this.state.Ma} onChange={this.handleChange} />
              </label>
              <label>
                Среднее время обработки требований:
                <input type="text" name="Ms" value={this.state.Ms} onChange={this.handleChange} />
              </label>
              <input type="submit" value="Submit" />
            </form>
          </div>
        </div>
        <div className="req-container">
          <div className="content-container">
            <h3>Начальные значения генераторов</h3>
            <form onSubmit={this.submitGenProps}>
              <label>
                Поступление требований:
                <input type="text" name="arrivalSeed" value={this.state.arrivalSeed} onChange={this.handleChange} />
              </label>
              <label>
                Обработка требований:
                <input type="text" name="processingSeed" value={this.state.processingSeed} onChange={this.handleChange} />
              </label>
              <label>
                Приоритет:
                <input type="text" name="prioritySeed" value={this.state.prioritySeed} onChange={this.handleChange} />
              </label>
              <input type="submit" value="Submit" />
            </form>
          </div>
        </div>
        <div className="req-container">
          <div className="content-container">
            <h3>Предварительные прогоны</h3>
            <Table data={this.state.results}/>
            <ParamsTable data={this.state.results}/>
          </div>
        </div>
          <div className="content-container">
            <LinePlot
              x={this.state.systemPropsSubmitted ? getTimes(0, this.state.results[this.state.results.length - 1], lastInd.waitingTimes.length) : [1]}
              y={this.state.systemPropsSubmitted ? lastInd.waitingTimes : [1]} width={2500} height={800}
            />
            <p>Рисунок - Время ожидания требований в очереди</p>
          </div>
          <div className="content-container">
            <LinePlot
              x={this.state.systemPropsSubmitted ? getTimes(0, this.state.results[this.state.results.length - 1], lastInd.systemUsageTime.length) : [1]}
              y={this.state.systemPropsSubmitted ? lastInd.systemUsageTime : [1]} width={2500} height={800}
            />
            <p>Рисунок - Коэффициент использования системы</p>
          </div>
          <div className="content-container">
            <LinePlot
              x={this.state.systemPropsSubmitted ? getTimes(0, this.state.results[this.state.results.length - 1], lastInd.lengthInQueue.length) : [1]}
              y={this.state.systemPropsSubmitted ? lastInd.lengthInQueue : [1]} width={2500} height={800}
            />
            <p>Рисунок - Число требований в очереди</p>
          </div>
          <div className="content-container">
            <LinePlot
              x={this.state.systemPropsSubmitted ? getTimes(0, this.state.results[this.state.results.length - 1], lastInd.avgInSystem.length) : [1]}
              y={this.state.systemPropsSubmitted ? lastInd.lengthInSystem : [1]} width={2500} height={800}
            />
            <p>Рисунок - Число требований в системе</p>
          </div>
          <div className="content-container">
            <LinePlot
              x={this.state.systemPropsSubmitted ? getTimes(0, this.state.results[this.state.results.length - 1], lastInd.avgInQueue.length) : [1]}
              y={this.state.systemPropsSubmitted ? lastInd.avgInQueue : [1]} width={2500} height={800}
            />
            <p>Рисунок - Среднее число требований в очереди</p>
          </div>
          <div className="content-container">
            <LinePlot
              x={this.state.systemPropsSubmitted ? getTimes(0, this.state.results[this.state.results.length - 1], lastInd.avgInSystem.length) : [1]}
              y={this.state.systemPropsSubmitted ? lastInd.avgInSystem : [1]} width={2500} height={800}
            />
            <p>Рисунок - Среднее число требований в системе</p>
          </div>
        </div>
      </div>
    )
  }
}

export default SMO