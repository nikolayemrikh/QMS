/* eslint-disable */
import * as generators from '../lib/generators';
import React, { Component } from 'react';
import { ScatterChart, ComposedChart, Bar, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import * as d3 from "d3";
import * as utils from '../lib/utils';
import d3Wrap from 'react-d3-wrap';
import * as main from '../lib/main';
import LinePlot from '../components/LinePlot'
var mathjs = require('mathjs');
var Combinatorics = require('js-combinatorics');

import { Container, Row, Col, FormGroup, Form, Label, Input, Option, Table, Button } from 'reactstrap';
Container.propTypes = {
  fluid:  React.PropTypes.bool
  // applies .container-fluid class
};

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
    indicators.lengthInQueue.push(indicators.priorQueue.length)
    indicators.lengthInSystem.push(indicators.priorQueue.length + indicators.requirementsInProcessing.length)
    if (!state.factorPlanBool) {
      indicators.delay += indicators.prevQueueLength * (indicators.currentTime - indicators.prevTime);
      indicators.prevQueueLength = indicators.priorQueue.length;
      // console.log(indicators, indicators.attendants)
      indicators.avgInQueue.push(getNq(indicators.lengthInQueue, indicators.currentTime));
      indicators.avgInSystem.push(getNs(indicators.lengthInSystem, indicators.currentTime));
      indicators.systemUsageTime.push(getP(indicators.attendantsBusyTime, indicators.currentTime));
    }
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
  let att = [];
  for (let i = 0; i < state.S; ++i) {
    abt.push([]);
    att.push(null);
  }

  let indicators = {
    prevTime: null,
    currentTime: 0,
    nextArrivalTime: RAT.shift(),
    nextPopTime: null,
    priorQueue: [],
    prevQueueLength: 0,
    attendants: att,
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
let lastState = {};
let factorPlanResults = [];
let factorPlanResultsTable = [];
let factorsLength;
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
  // console.log(indicators)
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

class MainTable extends Component {
  constructor(props) {
    super(props);

  }
  componentWillReceiveProps(props) {
    if (!props.data.length) return;
  }
  render() {
    let _self = this;
    return (
      <Table>
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
      </Table>
    );
  }
}

function computeProperties(inlres) {
  let mean = inlres.map(arr => {
    return utils.getMu(arr);
  });
  let D = inlres.map((arr, i) => {
    return utils.getD(arr, mean[i])
  });
  let E = mean.map(el => el * 0.05);
  let n = [];
  for (let i = 0, l = mean.length; i < l; ++i) {
    n.push((Math.pow(main.t, 2) * D[i]) / Math.pow(E[i], 2));
  }
  return [mean, D, E, n];
}

class FactorPlan extends Component {
  constructor(props) {
    super(props);

  }
  componentWillReceiveProps(props) {
    if (!props.data.length) return;
    // let inlres = [];
    // for (let i = 0, l = props.data.length; i < l; ++i) {
    //   let colVals = [];
    //   let row = props.data[i];
    //   for (let j = 0, n = row.length; j < n; ++j) {
    //     let elem = row[j];
    //     // this.state.mean[j] += elem;
    //     colVals.push(elem);
    //   }
    //   inlres.push(colVals);
    // }
    // console.log(inlres)
  }
  render() {
    let _self = this;
    return (
      <Table>
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
          <th>factor Ma</th>
          <th>factor Ms</th>
          <th>factor S</th>
          <th>factor I</th>
        </tr>
        </thead>
        <tbody>
        {this.props.data.map(function(row, i) {
          return (
            <tr key={i}>
              <td>{i + 1}</td>
              {row.map(function(col, j) {
                if (typeof col === 'number') {
                  return <td key={j}>{col}</td>;
                }
                else if (typeof col === 'boolean') {
                  return <td key={j}>{col === true ? '+' : '-'}</td>;
                }
                return <td key={j}>{col}</td>;
              })}
            </tr>
          );
        })}
        </tbody>
      </Table>
    );
  }
}

class Effects extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mains: [],
      variants: []
    }
  }
  componentWillReceiveProps(props) {
    if (!props.data.length) return;
    let resps = props.data[0];
    let factors = props.data[1];
    let initlialPlus = props.data[2];
    let initlialMinus = props.data[3];
    // Перевернем строки в столбцы
    let inlresps = resps[0].map(function(col, i) {
      return resps.map(function(row) {
        return row[i]
      })
    });
    let inlfactors = factors[0].map(function(col, i) {
      return factors.map(function(row) {
        return row[i]
      })
    });
    let lenAr = []
    for (let i = 0; i < inlfactors.length; ++i)
      lenAr[i] = i;

    let cmb;
    cmb = Combinatorics.power(lenAr);
    let variants = cmb.map();
    variants = variants.filter(el => {
      if (el.length) return el;
    });
    variants.sort(function (a, b) {
      return a.length - b.length;
    });
    console.log(variants)
    this.setState({variants: variants})

    console.log(inlresps, factors)
    // Посчитаем главные эффекты
    let mains = [];
    // Для каждого столбца средних значений из таблицы где P, Tq, Ts ... (для каждого отклика)
    for (let i = 0; i < inlresps.length; ++i) {
    // for (let i = 0; i < 1; ++i) {
      // Средние значения в столбце (массив из значений в столбце с каждой строки)
      let colMeans = inlresps[i];
      // Для каждой комбинации 1 2 3 1,3 1,2 3,2 1,2,3 1,2,4 ...
      let es = [];
      for (let v = 0; v < variants.length; ++v) {
        // Комбинация vart - массив из номеров столбцов факторов
        let vart = variants[v];
        let sum = 0;
        // Для каждого среднего значения в столбце отклика
        for (let k = 0; k < colMeans.length; ++k) {
          let factorBoolsRow = factors[k];
          // Для каждого номера столбца фактора в комбинации на этой строке
          let P = 1;
          for (let j = 0; j < vart.length; ++j) {
            let factorColNum = vart[j];
            let factorBool = factorBoolsRow[factorColNum];
            // let factorBool = factorCol[k];
            if (factorBool === true) {
              P *= initlialPlus[factorColNum];
            } else {
              P *= initlialMinus[factorColNum];
            }
          }
          let colMean = colMeans[k];
          sum += (colMean * P);
        }
        sum = sum / Math.pow(2, factors.length - 1);
        es.push(sum);
      }
      mains.push(es);
    }
    console.log(mains)
    mains = mains[0].map(function(col, i) {
      return mains.map(function(row) {
        return row[i]
      })
    });
    this.setState({mains: mains})


  }
  render() {
    let _self = this;
    return (
      <Table>
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
        </tr>
        </thead>
        <tbody>
        {this.state.mains.map(function(row, i) {
          return (
            <tr key={i}>
              <td>{'e' + _self.state.variants[i].map(el => el + 1).join(' ')}</td>
              {row.map(function(col, j) {
                return <td key={j}>{col.toFixed(2)}</td>;
              })}
            </tr>
          );
        })}
        </tbody>
      </Table>
    );
  }
}

let regressResult = [];
let regressVariants = [];
class Regress extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mains: [],
      variants: [],
      initlialPlus: null
    }
  }
  componentWillReceiveProps(props) {
    if (!props.data || !props.data.length) return;
    this.setState({mains: []});
    let resps = props.data[0];
    let factors = props.data[1];
    let initlialPlus = props.data[2];
    let initlialMinus = props.data[3];
    if (initlialPlus === this.state.initlialPlus) return;
    this.setState({initlialPlus: initlialPlus});
    // Перевернем строки в столбцы
    let inlresps = resps[0].map(function(col, i) {
      return resps.map(function(row) {
        return row[i]
      })
    });
    let inlfactors = factors[0].map(function(col, i) {
      return factors.map(function(row) {
        return row[i]
      })
    });
    let lenAr = []
    for (let i = 0; i < inlfactors.length; ++i)
      lenAr[i] = i;

    let cmb;
    cmb = Combinatorics.power(lenAr);
    let variants = cmb.map();
    variants.sort(function (a, b) {
      return a.length - b.length;
    });
    this.setState({variants: variants})
    regressVariants = variants;
    variants = variants.filter(el => {
      if (el.length) return el;
    });

    let result = [];
    // Для каждого столбца в факторном плане
    for (let i = 0, l = inlresps.length; i < l; ++i) {
    // for (let i = 0, l = 1; i < l; ++i) {
      let resultCol = [];
      let yMatrix = [];
      let columnVals = inlresps[i];
      // Для каждой строки в этом столбце
      for (let j = 0, n = columnVals.length; j < n; ++j) {
        // Там где a0 берем 1
        let resultRow = [1];
        let factorPlusOrMinus = factors[j];
            // console.log(factorPlusOrMinus)
        // Для каждой комбинации 1 2 3 1,3 1,2 3,2 1,2,3 1,2,4 ...
        for (let k = 0; k < variants.length; ++k) {
          let variant = variants[k];
          // Произведение пишем сюда
          let P = 1;
          for (let varPart of variant) {
            let val;
            if (factorPlusOrMinus[varPart] === true) {
              val = initlialPlus[varPart];
            } else {
              val = initlialMinus[varPart];
            }
            P *= val;
          }
          resultRow.push(P);
        }
        resultCol.push(resultRow);
        // Пушим значение отклика в матрицу
        yMatrix.push([columnVals[j]]);
      }
      // let resultColInverted = resultCol[0].map(function(col, i) {
      //   return resultCol.map(function(row) {
      //     return row[i]
      //   })
      // });
      let resultColInverted = mathjs.inv(resultCol);
      let columntResult = mathjs.multiply(resultColInverted, yMatrix);
      columntResult = columntResult.map(el => el[0]);
      // console.log(columntResult);
      result.push(columntResult);
    }
    regressResult = result;
    // regressVariants = variants;
    let resultInTable = result[0].map(function(col, i) {
      return result.map(function(row) {
        return row[i]
      })
    });
    this.setState({mains: resultInTable});
    // console.log(resultInTable)

  }
  render() {
    let _self = this;
    return (
      <Table>
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
        </tr>
        </thead>
        <tbody>
        {this.state.mains.map(function(row, i) {
          return (
            <tr key={i}>
              <td>{'a' + _self.state.variants[i].map(el => el + 1).join(' ')}</td>
              {row.map(function(col, j) {
                return <td key={j}>{col.toFixed(2)}</td>;
              })}
            </tr>
          );
        })}
        </tbody>
      </Table>
    );
  }
}

class CheckRegress extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mains: [],
      variants: [],
      initlialPlus: null
    }
  }
  componentWillReceiveProps(props) {
    if (!props.data || !props.data.length) return;
    this.setState({mains: []});
    let regressResults = props.data[0];
    let factors = props.data[1];
    let initlialPlus = props.data[2];
    let initlialMinus = props.data[3];
    if (initlialPlus === this.state.initlialPlus) return;
    this.setState({initlialPlus: initlialPlus});
    // Перевернем строки в столбцы
    let inlRegressResults = regressResults[0].map(function(col, i) {
      return regressResults.map(function(row) {
        return row[i]
      })
    });
    let inlfactors = factors[0].map(function(col, i) {
      return factors.map(function(row) {
        return row[i]
      })
    });
console.log(regressResults)
    let variants = regressVariants;
    let result = [];
    // Для каждого столбца
    for (let i = 0, l = regressResults.length; i < l; ++i) {
      // for (let i = 0, l = 1; i < l; ++i) {
      let resultCol = [];
      let columnCoefs = regressResults[i];
      // Для каждой строки в этом столбце
      for (let j = 0, n = columnCoefs.length; j < n; ++j) {
        let sum = 0;
        let factorPlusOrMinus = factors[j];
        // console.log(factorPlusOrMinus)
        // Для каждой комбинации    пусто 1 2 3 1,3 1,2 3,2 1,2,3 1,2,4 ...
        for (let k = 0; k < variants.length; ++k) {
          let variant = variants[k];
          // Произведение пишем сюда
          let P = 1;
          for (let varPart of variant) {
            let val;
            if (factorPlusOrMinus[varPart] === true) {
              val = initlialPlus[varPart];
            } else {
              val = initlialMinus[varPart];
            }
            P *= val;
          }
          P *= columnCoefs[k];
          sum += P;
        }
        resultCol.push(sum);
      }
      result.push(resultCol);
    }

    let resultInTable = result[0].map(function(col, i) {
      return result.map(function(row) {
        return row[i]
      })
    });

    let En = 0.15;
    let c1 = 6000000;
    let c2 = 10000;
    let c3 = 10000;
    let c4 = 0.05;
    let c5 = 0.086;
    let T = 25000000;
    // Для каждой строки с откликами посчитаем экон оценку
    for (let i = 0, l = resultInTable.length; i < l; ++i) {
      let vals = resultInTable[i];
      let I = En * c1 * main.S + c2 * (vals[4] - vals[3]) + c3 * (main.S - vals[4] + vals[3]) +
          c4 * T * (Math.pow(main.Ma, -1) - vals[5]) + c5 * T * vals[3];
      resultInTable[i].push(I);
    }

    this.setState({mains: resultInTable});


  }
  render() {
    let _self = this;
    return (
      <Table>
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
          <th>Econ</th>
        </tr>
        </thead>
        <tbody>
        {this.state.mains.map(function(row, i) {
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
      </Table>
    );
  }
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
    if (!props.data.length) return;
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
    console.log(inlres)
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
    lastState.mean = mean;
    lastState.D = D;
    lastState.E = E;
    lastState.n = n;
    console.log(lastState.n[0])
  }
  render() {
    let _self = this;
    return (
      <Table>
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
      </Table>
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

let If = React.createClass({
  render: function() {
    if (this.props.test) {
      return this.props.children;
    }
    else {
      return false;
    }
  }
});

//let factorPlanResultConst = [[0.6635170374430872,12.761742140184312,25.71805927824817,0.10629316644791406,0.2756269392428614,0.054065700126100714,1],[0.5975830165435736,8.915610559267062,25.59520700348915,0.06714787367949768,0.21220481036638933,0.04869316437962122,1],[0.7949340951961197,25.427960212831596,29.91765376105333,0.17985587290132626,0.36618914818805465,0.053978353211682595,1],[0.7161979290995797,18.83273628602925,30.272377990985227,0.11773791932375785,0.2762294018004728,0.04863193693670296,1],[0.44312177259804436,1.9345590375977404,26.076597765353885,0.021935075018781836,0.21274314734265418,0.054160679058720504,1],[0.39889427449534015,1.3827072849885027,26.403257425916863,0.013846408948376748,0.17542034998682948,0.04875496108583366,1],[0.5308885064964556,3.8983548781904465,30.702879391920856,0.03806762194811272,0.25176540879319953,0.05407332663084182,1],[0.47840916810121187,2.9731521383668853,31.042859781539228,0.02538732731909594,0.20602230308087852,0.04872807546851431,1],[0.6635170374430872,12.761742140184312,25.71805927824817,0.10629316644791406,0.2756269392428614,0.054065700126100714,1],[0.5975830165435736,8.915610559267062,25.59520700348915,0.06714787367949768,0.21220481036638933,0.04869316437962122,1],[0.7949340951961197,25.427960212831596,29.91765376105333,0.17985587290132626,0.36618914818805465,0.053978353211682595,1],[0.7161979290995797,18.83273628602925,30.272377990985227,0.11773791932375785,0.2762294018004728,0.04863193693670296,1],[0.44312177259804436,1.9345590375977404,26.076597765353885,0.021935075018781836,0.21274314734265418,0.054160679058720504,1],[0.39889427449534015,1.3827072849885027,26.403257425916863,0.013846408948376748,0.17542034998682948,0.04875496108583366,1],[0.5308885064964556,3.8983548781904465,30.702879391920856,0.03806762194811272,0.25176540879319953,0.05407332663084182,1],[0.47840916810121187,2.9731521383668853,31.042859781539228,0.02538732731909594,0.20602230308087852,0.04872807546851431,1]];
let factorPlanResultConst = [[0.7605384855028976,20.49895249745666,28.669205544110888,0.1530097676940443,0.33787611447305194,0.054548936789320615,1],[0.684607072746961,14.051201275082727,28.786472267254105,0.09422832061328751,0.25121005120249024,0.049102824707288946,1],[0.8142403466526136,29.314603383556143,30.523314682260576,0.20734568315354612,0.39997440141449,0.05450727738000682,1],[0.7335292982913877,18.297466993156405,30.72651202369553,0.11672087052103387,0.279796180155175,0.04910427872151194,1],[0.5080228601434106,2.613017692471235,28.95567995942993,0.026562923908006818,0.23567762940601947,0.05465622203293587,1],[0.45737364126814645,1.8709899398225518,29.142862568956964,0.01707485250347052,0.19289170551471016,0.049207067733344434,1],[0.5441740205761055,3.6082676098682755,31.223040978601546,0.035408370465980714,0.25430641380968266,0.05464254701540238,1],[0.48994049359962405,2.478129539514914,30.579088527488825,0.021302195303795048,0.2050520785824889,0.04919675589791,1],[0.7605384855028976,20.49895249745666,28.669205544110888,0.1530097676940443,0.33787611447305194,0.054548936789320615,1],[0.684607072746961,14.051201275082727,28.786472267254105,0.09422832061328751,0.25121005120249024,0.049102824707288946,1],[0.8142403466526136,29.314603383556143,30.523314682260576,0.20734568315354612,0.39997440141449,0.05450727738000682,1],[0.7335292982913877,18.297466993156405,30.72651202369553,0.11672087052103387,0.279796180155175,0.04910427872151194,1],[0.5080228601434106,2.613017692471235,28.95567995942993,0.026562923908006818,0.23567762940601947,0.05465622203293587,1],[0.45737364126814645,1.8709899398225518,29.142862568956964,0.01707485250347052,0.19289170551471016,0.049207067733344434,1],[0.5441740205761055,3.6082676098682755,31.223040978601546,0.035408370465980714,0.25430641380968266,0.05464254701540238,1],[0.48994049359962405,2.478129539514914,30.579088527488825,0.021302195303795048,0.2050520785824889,0.04919675589791,1]];

function optimal(regressResult, baseN, initialPlus, initialMinus) {
  let allResults = [];
  let optimals = [];
  let variants = regressVariants;

  let En = 0.15;
  let c1 = 6000000;
  let c2 = 10000;
  let c3 = 10000;
  let c4 = 0.05;
  let c5 = 0.086;
  let T = 25000000;

  let d1min, d1max;
  let d2min, d2max;
  let d3min, d3max;
  let d4min, d4max;

  d1min = Math.min(parseInt(initialMinus[0]), parseInt(initialPlus[0]));
  d1max = Math.max(parseInt(initialMinus[0]), parseInt(initialPlus[0]));
  d2min = Math.min(parseInt(initialMinus[1]), parseInt(initialPlus[1]));
  d2max = Math.max(parseInt(initialMinus[1]), parseInt(initialPlus[1]));
  d3min = Math.min(parseInt(initialMinus[2]), parseInt(initialPlus[2]));
  d3max = Math.max(parseInt(initialMinus[2]), parseInt(initialPlus[2]));
  d4min = Math.min(parseInt(initialMinus[3]), parseInt(initialPlus[3]));
  d4max = Math.max(parseInt(initialMinus[3]), parseInt(initialPlus[3]));


  let optI = false;
  let optRes = [0, 200000, 200000, 200000, 200000, 0, 0.5, 99999999999];

  for (let d1i = d1min, d1delta = 0.1; d1i < d1max; d1i += d1delta) {
    for (let d2i = d2min, d2delta = 0.1; d2i < d2max; d2i += d2delta) {
      for (let d3i = d3min, d3delta = 0.1; d3i < d3max; d3i += d3delta) {
        for (let d4i = d4min, d4delta = 0.1; d4i < d4max; d4i += d4delta) {
          let initialPlusPart = [d1i + d1delta, d2i + d2delta, d3i + d3delta, d4i + d4delta];
          let initialMinusPart = [d1i, d2i, d3i, d4i];
          let result = [];
          // Для каждого столбца
          for (let i = 0, l = regressResult.length; i < l; ++i) {
            // for (let i = 0, l = 1; i < l; ++i) {
            let resultCol = [];
            let columnCoefs = regressResult[i];
            // Для каждой строки в этом столбце
            for (let j = 0, n = columnCoefs.length; j < n; ++j) {
              let sum = 0;
              let factorPlusOrMinus = baseN[j];
              // console.log(factorPlusOrMinus)
              // Для каждой комбинации    пусто 1 2 3 1,3 1,2 3,2 1,2,3 1,2,4 ...
              for (let k = 0; k < variants.length; ++k) {
                let variant = variants[k];
                // Произведение пишем сюда
                let P = 1;
                for (let varPart of variant) {
                  let val;
                  if (factorPlusOrMinus[varPart] === true) {
                    val = initialPlusPart[varPart];
                  } else {
                    val = initialMinusPart[varPart];
                  }
                  P *= val;
                }
                P *= columnCoefs[k];
                sum += P;
              }
              resultCol.push(sum);
            }
            result.push(resultCol);
          }
          let resultInTable = result[0].map(function(col, i) {
            return result.map(function(row) {
              return row[i]
            })
          });

          // Для каждой строки с откликами посчитаем экон оценку
          for (let i = 0, l = resultInTable.length; i < l; ++i) {
            let vals = resultInTable[i];
            let I = En * c1 * main.S + c2 * (vals[4] - vals[3]) + c3 * (main.S - vals[4] + vals[3]) +
              c4 * T * (Math.pow(main.Ma, -1) - vals[5]) + c5 * T * vals[3];
            resultInTable[i].push(I);
            // if (optI === false || I < optI) {
            //   optRes = resultInTable[i];
            // }
          }

          // allResults.push(...resultInTable);
          // Найдем самый оптимальный вариант в текущей выборке
          let found = resultInTable.find(el => {
            if (el[0] >= optRes[0] && el[0] <= 0.7 && // Коэфф использования больше 0.6 и <= 0.7
              el[6] > 0.9 && el[6] <= 1 && // Пропускная способность больше 0.9 и не превышает 1
              el[1] <= optRes[1] && el[1] > 0 && //среднее время ожидания заявки в очереди меньше, чем у оптимального предыдущего
              el[7] <= optRes[7]) {
                return el;
              }
          });
          if (found) optRes = found;

          // optimals.push(...resultInTable);
        }
      }
    }
  }
  console.log(optRes)
}

class SMO extends Component {
  constructor(props) {
    super(props);
    this.state = {
      N: main.N,
      S: main.S,
      I: main.I,
      Ma: main.Ma,
      Ms: main.Ms,
      Nminus: main.N,
      Sminus: main.S,
      Iminus: main.I,
      Maminus: main.Ma,
      Msminus: main.Ms,
      Nplus: main.N,
      Splus: main.S,
      Iplus: main.I,
      Maplus: main.Ma,
      Msplus: main.Ms,
      arrivalSeed: 17147,
      processingSeed: 6773575356,
      prioritySeed: 718882,
      results: [],
      systemPropsSubmitted: false,
      resultsInline: [[], [], [], [], [], [], [], []],
      factorResults: [],
      // plots: false,
      factorPlan: [],
      factorPlanBool: false,
      effectsRawData: [],
      baseN: []
    };

    this.handleChange = this.handleChange.bind(this);
    this.submitSystemProps = this.submitSystemProps.bind(this);
    this.submitGenProps = this.submitGenProps.bind(this);
    this.factorPlanHandle = this.factorPlanHandle.bind(this);
    this.calculateEffects = this.calculateEffects.bind(this);
    this.calculateRegress = this.calculateRegress.bind(this);
    this.checkRegress = this.checkRegress.bind(this);
    this.findOptimal = this.findOptimal.bind(this);
  }
  setRandomSeeds() {
    let arrivalSeed = main.arrivalSeedLMG.next().value;
    let processingSeed = main.processingSeedLMG.next().value;
    let prioritySeed = main.prioritySeedLMG.next().value;
    // Зададим рандомно начальные значения
    this.setState({arrivalSeed: arrivalSeed});
    this.setState({processingSeed: processingSeed});
    this.setState({prioritySeed: prioritySeed});
    return [arrivalSeed, processingSeed, prioritySeed];
  }
  handleChange(event) {
    this.setState({[event.target.name]: event.target.value});
  }
  submitSystemProps(e) {
    e.preventDefault();
    // this.setState({systemPropsSubmitted: true});
  }
  findOptimal(e) {
    e.preventDefault();
    let initialValsPlus = [this.state.Maplus, this.state.Msplus, this.state.Splus, this.state.Iplus];
    let initialValsMinus = [this.state.Maminus, this.state.Msminus, this.state.Sminus, this.state.Iminus];
    optimal(regressResult, this.state.baseN, initialValsPlus, initialValsMinus);
  }
  calculateRegress(e) {
    e.preventDefault();
    let initialValsPlus = [this.state.Maplus, this.state.Msplus, this.state.Splus, this.state.Iplus];
    let initialValsMinus = [this.state.Maminus, this.state.Msminus, this.state.Sminus, this.state.Iminus];
    // let baseN = Combinatorics.baseN([true, false], initialValsPlus.length); // Сгенерируем варианты (2^4)
    // baseN = baseN.toArray();
    // this.setState({regressData: [factorPlanResults, this.state.baseN, initialValsPlus, initialValsMinus]});
    this.setState({regressData: [factorPlanResultConst, this.state.baseN, initialValsPlus, initialValsMinus]});
  }
  checkRegress(e) {
    e.preventDefault();
    let initialValsPlus = [this.state.Maplus, this.state.Msplus, this.state.Splus, this.state.Iplus];
    let initialValsMinus = [this.state.Maminus, this.state.Msminus, this.state.Sminus, this.state.Iminus];
    // let baseN = Combinatorics.baseN([true, false], initialValsPlus.length); // Сгенерируем варианты (2^4)
    // baseN = baseN.toArray();
    this.setState({checkRegressData: [regressResult, this.state.baseN, initialValsPlus, initialValsMinus]});
  }
  calculateEffects(e) {
    e.preventDefault();
    let initialValsPlus = [this.state.Maplus, this.state.Msplus, this.state.Splus, this.state.Iplus];
    let initialValsMinus = [this.state.Maminus, this.state.Msminus, this.state.Sminus, this.state.Iminus];
    // let baseN = Combinatorics.baseN([true, false], initialValsPlus.length); // Сгенерируем варианты (2^4)
    // baseN = baseN.toArray();
    this.setState({effectsRawData: [factorPlanResults, this.state.baseN, initialValsPlus, initialValsMinus]});
    // this.setState({effectsRawData: [factorPlanResultConst, this.state.baseN, initialValsPlus, initialValsMinus]});
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
    let baseN = Combinatorics.baseN([true, false], 4); // Сгенерируем варианты (2^4)
    baseN = baseN.toArray();
    this.setState({baseN: baseN})
    console.log("TEST")

  }
  factorPlanHandle(e) {
    e.preventDefault();
    let initialValsPlus = [this.state.Maplus, this.state.Msplus, this.state.Splus, this.state.Iplus];
    let initialValsMinus = [this.state.Maminus, this.state.Msminus, this.state.Sminus, this.state.Iminus];
    factorsLength = initialValsMinus.length;


    /*let baseN = Combinatorics.baseN([true, false], initialValsPlus.length); // Сгенерируем варианты (2^4)
    baseN = baseN.toArray();

    this.setState({baseN: baseN})*/
    // k - строка факторного плана
    let k = 0;
    // Значения Mu, D, E и n после начальных прогонов
    let resultState = JSON.parse(JSON.stringify(lastState));
    // Массив средних значений начальных прогонов
    let resultSeeds = [];
    console.log(resultState.n)
    while (k < Math.pow(2, initialValsPlus.length)) {
    // while (k < 5) {
      let resultMeans = [];
      let resultTable = [];
      // Выберем текущие уровни для данной строки факторного плана
      let currentLevels = this.state.baseN[k];
      console.log(currentLevels)
      // Не для каждой строке же нужно генерить сиды, а для каждого прогона
      // let seeds = this.setRandomSeeds();
      // resultMeans.push(seeds);
      // Для каждого параметра системы из таблицы кроме полного времени работы системы
      for (let i = 0, l = resultState.mean.length - 1; i < l; ++i) {
        // количество прогонов, нужное для этого параметра
        let n = resultState.n[i];
        if (n === 0) {
          resultMeans.push(resultState.mean[i]);
          break;
        }
        // Номер прогона
        let j = 0;
        let vals = [];
        // Пока не выполним нужное количетсво прогонов для данного параметра
        while (j < n) {
          // Зададим среднее значение интервалов времени между поступлением требований
          let reqArrivalTime = main.getReqArrivalTime(this.state.arrivalSeed, {N: this.state.N, Ma: currentLevels[0] ? initialValsPlus[0] : initialValsMinus[0]});
          let reqProcessingTime = main.getReqProcessingTime(this.state.processingSeed, {N: this.state.N, Ms: currentLevels[1] ? initialValsPlus[1] : initialValsMinus[1]});
          let priority = main.getArrivalPriority(this.state.prioritySeed, {N: this.state.N});
          // Выполним прогон с заданными параметрами (тут задается размер очереди I)
          let indicators = lol(getInitIndicators(reqArrivalTime, {S: currentLevels[2] ? initialValsPlus[2] : initialValsMinus[2]}), reqArrivalTime, reqProcessingTime, priority, {I: currentLevels[3] ? initialValsPlus[3] : initialValsMinus[3]});
          // Получим конечные значения параметров системы
          let res = getResult(indicators, {N: this.state.N});
          // Возьмем только нужный нам
          let currVal = res[i];
          // Запихаем его к другим
          vals.push(currVal);
          // Зададим рандомные сиды
          this.setRandomSeeds();
          resultSeeds.push([this.state.arrivalSeed, this.state.processingSeed, this.state.prioritySeed]);
          j++;
        }
        // После n прогонов посчитаем среднее значение данного параметра
        let currMean = utils.getMu(vals);
        // Запушим среднее значение в результирующий массив средних значений параметров системы (откликов)
        resultMeans.push(currMean);
      }
      // Запушим все строки плана в массив
      k++;
      factorPlanResults.push(resultMeans);
      resultTable.push(...resultMeans);
      resultTable.push(...currentLevels);
      factorPlanResultsTable.push(resultTable);
      console.log(factorPlanResults)
      this.setState({factorPlan: factorPlanResultsTable});
    }
    console.log(factorPlanResultsTable)
  }
  render() {
    return (
      <Container fluid={true}>
        <Col>
        <Row>
          <Col>
          <h3>Параметры системы</h3>
          <Form onSubmit={this.submitSystemProps}>
            <FormGroup>
              <Label for="mainN">Количество требований:</Label>
              <Input id="mainN" type="text" name="N" value={this.state.N} onChange={this.handleChange} />
            </FormGroup>
            <FormGroup>
              <Label for="mainS">Количество обслуживающих устройств:</Label>
              <Input type="text" name="S" value={this.state.S} onChange={this.handleChange} />
            </FormGroup>
            <FormGroup>
              <Label for="mainI">Ёмкость накопителя:</Label>
              <Input type="text" name="I" value={this.state.I} onChange={this.handleChange} />
            </FormGroup>
            <FormGroup>
              <Label for="mainMa">Среднее время поступления требований:</Label>
              <Input type="text" name="Ma" value={this.state.Ma} onChange={this.handleChange} />
            </FormGroup>
            <FormGroup>
              <Label for="mainMs">Среднее время обработки требований:</Label>
              <Input type="text" name="Ms" value={this.state.Ms} onChange={this.handleChange} />
            </FormGroup>
            {/*<Input type="submit" value="Submit" />*/}
          </Form>
          </Col>
          <Col>
          <h3>Начальные значения генераторов</h3>
          <Form onSubmit={this.submitGenProps}>
            <FormGroup>
              <Label for="arrivalSeed">Поступление требований:</Label>
              <Input id="arrivalSeed" type="text" name="arrivalSeed" value={this.state.arrivalSeed} onChange={this.handleChange} />
            </FormGroup>
            <FormGroup>
              <Label for="processingSeed">Обработка требований:</Label>
              <Input id="processingSeed" type="text" name="processingSeed" value={this.state.processingSeed} onChange={this.handleChange} />
            </FormGroup>
            <FormGroup>
              <Label for="prioritySeed">Приоритет:</Label>
              <Input id="prioritySeed" type="text" name="prioritySeed" value={this.state.prioritySeed} onChange={this.handleChange} />
            </FormGroup>
            <Input type="submit" value="Submit" />
          </Form>
          </Col>
        </Row>
        <Row>
          <Col>
            <h3>Предварительные прогоны</h3>
            <MainTable data={this.state.results}/>
            <ParamsTable data={this.state.results}/>
          </Col>
        </Row>
          {/*<If test={this.state.plots}>*/}
          <Row>
            <Col>
              <LinePlot
                x={this.state.systemPropsSubmitted ? getTimes(0, this.state.results[this.state.results.length - 1], lastInd.waitingTimes.length) : [1]}
                y={this.state.systemPropsSubmitted ? lastInd.waitingTimes : [1]} width={1000} height={600}
              />
              <p>Рисунок - Время ожидания требований в очереди</p>
            </Col>
          </Row>
          <Row>
            <Col>
              <LinePlot
                x={this.state.systemPropsSubmitted ? getTimes(0, this.state.results[this.state.results.length - 1], lastInd.systemUsageTime.length) : [1]}
                y={this.state.systemPropsSubmitted ? lastInd.systemUsageTime : [1]} width={1000} height={600}
              />
              <p>Рисунок - Коэффициент использования системы</p>
            </Col>
          </Row>
          <Row>
            <Col>
              <LinePlot
                x={this.state.systemPropsSubmitted ? getTimes(0, this.state.results[this.state.results.length - 1], lastInd.lengthInQueue.length) : [1]}
                y={this.state.systemPropsSubmitted ? lastInd.lengthInQueue : [1]} width={1000} height={600}
              />
              <p>Рисунок - Число требований в очереди</p>
            </Col>
          </Row>
          <Row>
            <Col>
              <LinePlot
                x={this.state.systemPropsSubmitted ? getTimes(0, this.state.results[this.state.results.length - 1], lastInd.avgInSystem.length) : [1]}
                y={this.state.systemPropsSubmitted ? lastInd.lengthInSystem : [1]} width={1000} height={600}
              />
              <p>Рисунок - Число требований в системе</p>
            </Col>
          </Row>
          <Row>
            <Col>
              <LinePlot
                x={this.state.systemPropsSubmitted ? getTimes(0, this.state.results[this.state.results.length - 1], lastInd.avgInQueue.length) : [1]}
                y={this.state.systemPropsSubmitted ? lastInd.avgInQueue : [1]} width={1000} height={600}
              />
              <p>Рисунок - Среднее число требований в очереди</p>
            </Col>
          </Row>
          <Row>
            <Col>
              <LinePlot
                x={this.state.systemPropsSubmitted ? getTimes(0, this.state.results[this.state.results.length - 1], lastInd.avgInSystem.length) : [1]}
                y={this.state.systemPropsSubmitted ? lastInd.avgInSystem : [1]} width={1000} height={600}
              />
              <p>Рисунок - Среднее число требований в системе</p>
            </Col>
          </Row>
        {/*</If>*/}
        <Row>
          <Col>
            <h3>Параметры системы</h3>
            <Form onSubmit={this.factorPlanHandle} inline>
              <Row>
                <Label for="Maplus">Среднее время поступления требований +:</Label>
                <Input type="text" name="Maplus" id="Maplus" value={this.state.Maplus} onChange={this.handleChange} />
                <Label for="Msplus">Среднее время обработки требований +:</Label>
                <Input type="text" name="Msplus" id="Msplus" value={this.state.Msplus} onChange={this.handleChange} />
                <Label for="Splus">Количество обслуживающих устройств +:</Label>
                <Input type="text" name="Splus" id="Splus" value={this.state.Splus} onChange={this.handleChange} />
                <Label for="Iplus">Ёмкость накопителя +:</Label>
                <Input type="text" name="Iplus" id="Iplus" value={this.state.Iplus} onChange={this.handleChange} />
              </Row>
              <Row>
                <Label for="Maminus">Среднее время поступления требований -:</Label>
                <Input type="text" name="Maminus" id="Maminus" value={this.state.Maminus} onChange={this.handleChange} />
                <Label for="Msminus">Среднее время обработки требований -:</Label>
                <Input type="text" name="Msminus" id="Msminus" value={this.state.Msminus} onChange={this.handleChange} />
                <Label for="Sminus">Количество обслуживающих устройств -:</Label>
                <Input type="text" name="Sminus" id="Sminus" value={this.state.Sminus} onChange={this.handleChange} />
                <Label for="Iminus">Ёмкость накопителя -:</Label>
                <Input type="text" name="Iminus" id="Iminus" value={this.state.Iminus} onChange={this.handleChange} />
              </Row>
              <Input type="submit" value="Submit" />
            </Form>
          </Col>
        </Row>
        <Row>
          <FactorPlan data={this.state.factorPlan}/>
        </Row>
        <Row>
          <Button onClick={this.calculateEffects}>Рассчитать эффекты</Button>
          <Effects data={this.state.effectsRawData}/>
          <Button onClick={this.calculateRegress}>Рассчитать регрессию</Button>
          <Regress data={this.state.regressData}/>
          <Button onClick={this.checkRegress}>Проверить коэффициенты регрессии</Button>
          <p>Задайте приращения для начальных + и - значений выше</p>
          <CheckRegress data={this.state.checkRegressData}/>
          <Button onClick={this.findOptimal}>Найти минимальное значение ф-ии и оптимальные значения системы</Button>
        </Row>
      </Col>
    </Container>
    )
  }
}

export default SMO