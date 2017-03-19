/* eslint-disable */
import React, { Component } from 'react';
import { ScatterChart, ComposedChart, Bar, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import * as d3 from "d3";
import * as utils from '../lib/utils';
import d3Wrap from 'react-d3-wrap';
import * as main from '../lib/main';

let reqArrivalTime = main.getReqArrivalTime();
let reqProcessingTime = main.getReqProcessingTime();
let priority = main.getArrivalPriority();

let RAT = Array.from(reqArrivalTime);
let RPT = Array.from(reqProcessingTime);
let PR = Array.from(priority);

// let reqArrivalTime = [0.1, 0.2, 0.15, 0.1, 0.2];
// let reqProcessingTime = [0.5, 0.5, 0.5, 0.8, 1.0];
// let priority = [1, 4, 2, 1, 2];

let sumProcessingTimeNeeded = reqProcessingTime.reduce((cur, prev) => cur + prev);

function lol(indicators) {
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
        if (indicators.priorQueue.length < main.I) {
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
    indicators.avgInQueue.push(indicators.priorQueue.length)
    indicators.avgInSystem.push(indicators.priorQueue.length + indicators.requirementsInProcessing.length)
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

let abt = [];
for (let i = 0; i < main.S; ++i) {
  abt.push([]);
}

let indicators = {
  prevTime: null,
  currentTime: 0,
  nextArrivalTime: reqArrivalTime.shift(),
  nextPopTime: null,
  priorQueue: [],
  prevQueueLength: 0,
  attendants: new Array(main.S).fill(null),
  requirementsInProcessing: [],
  delay: 0,
  serviceTime: 0,
  attendantsBusyTime: abt,
  rufuseCounter: 0,
  waitingTimes: [],
  processingTimes: [],
  avgInQueue: [],
  avgInSystem: []
};
indicators = lol(indicators);
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
    U += attendantsBusyTime[i].reduce((a,b) => a+b) / modelingTime;
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

const getNq = (avgInQueue, modelingTime) => {
  return avgInQueue.reduce((a,b) => a+b) / modelingTime;
};

const getNs = (avgInSystem, modelingTime) => {
  return avgInSystem.reduce((a,b) => a+b) / modelingTime;
};

const getCa = (cuccessReqLength, modelingTime) => {
  return cuccessReqLength / modelingTime;
};

const getCr = (cuccessReqLength, n) => {
  return cuccessReqLength / n;
};

function getResults(indicators) {
  console.log(`Время работы каждого устройства: ${indicators.attendantsBusyTime.map(el => el.reduce((a,b) => a+b))}`);

  let p = getP(indicators.attendantsBusyTime, indicators.currentTime);
  console.log(`Коэффициент использования системы: ${p}`);
  let Tq = getTq(indicators.waitingTimes);
  console.log(`Среднее время ожидания заявки в очереди: ${Tq}`);
  let Ts = getTs(indicators.processingTimes);
  console.log(`Среднее время пребывания заявки в системе: ${Ts}`);
  console.log(`Общее время моделирования: ${indicators.currentTime}`);
  console.log(`Среднее по времени число требований в очереди: ${getNq(indicators.avgInQueue, indicators.currentTime)}`);
  console.log(`Среднее по времени число требований в системе: ${getNq(indicators.avgInSystem, indicators.currentTime)}`);
  console.log(`Абсолютная пропускная способность системы: ${getCr(main.N - indicators.rufuseCounter, main.N)}`);
}

getResults(indicators);

class SMO extends Component {
  render() {
    return (
      <div className="container">
        <p>test</p>
      </div>
    )
  }
}

export default SMO