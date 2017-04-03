/* eslint-disable */
import * as generators from './generators';
import * as utils from './utils';

// Кол-во обслуживающих устройств
export const S = 3;
// Ёмкость накопителя (макс кол-во находящихся в очереди людей)
export const I = 20;
// Среднее время поступления требований
export const Ma = 20;
// Среднее время обработки требований
export const Ms = 30;
// Отклонение для времени оброботки (задал сам)
const Ds = 400;
export const N = 1000;

export const t = 1.96;

export const k = 8;

export const Pi = [0.35, 0.25, 0.2, 0.15, 0.05];

// Квантиль распределения Хи квадрат при alpha = 0.05 (порядка 1-alpha = 0.95) и k - 1 = 16 степенями свободы
export const quantille = 26.2962;

export const getReqArrivalTime = (seed, props) => {
  let n = props && props.N ? props.N : N;
  let ma = props && props.Ma ? props.Ma : Ma;
  let expDistributionGen1 = generators.genericGenerator(generators.expDistrib, n, seed, {Mu: ma});
  let reqArrivalTime = [...expDistributionGen1];
  // console.log(reqArrivalTime);
  return reqArrivalTime;
};

export const getReqProcessingTime = (seed, props) => {
  let n = props && props.N ? props.N : N;
  let ms = props && props.Ms ? props.Ms : Ms;
  let expDistributionGen2 = generators.genericGenerator(generators.erlangDistrib, n, seed, {Mu: ms, k: k});
  // let expDistributionGen2 = generators.genericGenerator(generators.logNormDistrib, N, {Mu: Ms, D: Ds});
  let reqProcessingTime = [...expDistributionGen2];
  // console.log(reqProcessingTime);
  return reqProcessingTime;
};

export const discreteN = 5;
export const discreteM = 2;
export const discreteD = 1;


export const getArrivalPriority = (seed, props) => {
  let n = props && props.N ? props.N : N;
  let pi = props && props.Pi ? props.Pi : Pi;
  // let bernoulliDiscreteGen = generators.discreteDistrib(generators.expDistrib, n, seed, discreteN, {Mu: discreteM, D: discreteD});
  let bernoulliDiscreteGen = generators.disDist(generators.uniDistrib, n, seed, pi);
  let arrivalPriority = [...bernoulliDiscreteGen];
  // console.log(arrivalPriority)
  return arrivalPriority;
};

const m1 = Math.pow(2, 32);
const a1 = 1664525;
const m2 = Math.pow(2, 31);
const a2 = 22695477;
const m3 = Math.pow(2, 24);
const a3 = 1140671485;
export const arrivalSeedLMG = generators.linMultGen(664676345, m1, a1);
export const processingSeedLMG = generators.linMultGen(5, m2, a2);
export const prioritySeedLMG = generators.linMultGen(12385764, m3, a3);