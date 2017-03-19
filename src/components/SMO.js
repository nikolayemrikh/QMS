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

// let reqArrivalTime = [0.1, 0.2, 0.15, 0.1, 0.2];
// let reqProcessingTime = [0.5, 0.5, 0.5, 0.8, 1.0];
// let priority = [1, 4, 2, 1, 2];

let sumProcessingTimeNeeded = reqProcessingTime.reduce((cur, prev) => cur + prev);

function lol() {
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
          popTime: indicators.currentTime + procTime
        });
        attendantsBusyTime[freeAttendantIndex] += procTime;
      } else { // Если устройства заняты
        let req = {
          priority: nextPriority,
          processingTime: reqProcessingTime.shift()
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
            otkaz++
          } else {
            // Отказ не нужен для следующего приоритета - значит удаляем первый приоритет из очереди, ибо он меньше того, который пришел
            indicators.priorQueue.shift();
            // Вставляем в очередь на место, идущее за последним таким же приоритетом либо выше
            const indexToInsert = findIndexToInsert(indicators.priorQueue, nextPriority);
            indicators.priorQueue.splice(indexToInsert, 0, req);
          }
        }
        ppp.push(indicators.priorQueue.length)
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
        let procTime = indicators.priorQueue.pop().processingTime;
        let req = {
          attendantIndex: attIndexToFree,
          popTime: indicators.currentTime + procTime
        };
        indicators.requirementsInProcessing.splice(indexToPop, 1, req);
        attendantsBusyTime[attIndexToFree] += procTime;
      } else {
        indicators.attendants[attIndexToFree] = null;
        indicators.requirementsInProcessing.splice(indexToPop, 1);
      }
      indicators.nextPopTime = getNextPopTime(indicators.requirementsInProcessing, reqProcessingTime);
    }
    indicators.delay += indicators.prevQueueLength * (indicators.currentTime - indicators.prevTime);
    indicators.prevQueueLength = indicators.priorQueue.length;
    // console.log(indicators, indicators.attendants, otkaz)
    console.log(indicators.delay)
  }
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

const attendantsBusyTime = new Array(main.S).fill(0);
const indicators = {
  prevTime: null,
  currentTime: 0,
  nextArrivalTime: reqArrivalTime.shift(),
  nextPopTime: null,
  priorQueue: [],
  prevQueueLength: 0,
  attendants: new Array(main.S).fill(null),
  requirementsInProcessing: [],
  delay: 0,
  serviceTime: 0
};
let otkaz = 0;
let processedRequiremnts = [];
let ppp=[];
lol()

// Время работы каждого устройства
console.log(attendantsBusyTime);
// Время работы всех устройств
console.log(attendantsBusyTime.reduce((c, p) => c + p));
// Время, которое должно было быть затрачено на обработку, если бы не было отказов
console.log(sumProcessingTimeNeeded);


console.log(reqArrivalTime.length, reqProcessingTime.length, priority.length, otkaz);

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