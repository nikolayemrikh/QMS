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

// Квантиль распределения Хи квадрат при alpha = 0.05 (порядка 1-alpha = 0.95) и k - 1 = 16 степенями свободы
export const quantille = 26.2962;

export const getReqArrivalTime = () => {
  let expDistributionGen1 = generators.genericGenerator(generators.expDistrib, N, {Mu: Ma});
  let reqArrivalTime = [...expDistributionGen1];
  // console.log(reqArrivalTime);
  return reqArrivalTime;
};

export const getReqProcessingTime = () => {
  let expDistributionGen2 = generators.genericGenerator(generators.erlangDistrib, N, {Mu: Ms, k: k});
  // let expDistributionGen2 = generators.genericGenerator(generators.logNormDistrib, N, {Mu: Ms, D: Ds});
  let reqProcessingTime = [...expDistributionGen2];
  // console.log(reqProcessingTime);
  return reqProcessingTime;
};

export const discreteN = 5;
export const discreteM = 2;
export const discreteD = 1;


export const getArrivalPriority = () => {
  let bernoulliDiscreteGen = generators.discreteDistrib(generators.expDistrib, 1000, discreteN, {Mu: discreteM, D: discreteD});
  let arrivalPriority = [...bernoulliDiscreteGen];
  return arrivalPriority;
};