/* eslint-disable */
import {t} from './main';

export const compare = (left, right) => {
  if (left < right) return -1;
  if (left > right) return 1;
  if (left == right) return 0;
};

export const getNextFromPrevData = (arr, evalD) => {
  let data = [];
  for (let i = 0; i < arr.length - 1; ++i) {
    let current = arr[i];
    let next = arr[i + 1];
    let point = {
      x: current,
      y: next
    };
    data.push(point);
  }
  data = data.filter(point => {
    return point.x < Math.sqrt(evalD) * 4 && point.y < Math.sqrt(evalD) * 4
  });
  return data;
};

export const getMu = (randomVariable) => {
  let sum = 0;
  for (let x of randomVariable) {
    sum += x;
  }
  return sum / randomVariable.length;
};

export const getD = (randomVariable, Mu) => {
  let n = randomVariable.length;
  let sum = 0;
  for (let x of randomVariable) {
    sum += Math.pow(x - Mu, 2);
  }
  return sum !== 0 ? sum / (n - 1) : 0;
};

export const getCovar = (randomVariable, Mu) => {
  const n = randomVariable.length;
  let k = [];
  for (let j = 0; j < n - 1; ++j) {
    let sum = 0;
    for (let i = 0; i < n - j; ++i) {
      sum += ((randomVariable[i] - Mu) * (randomVariable[i + j] - Mu))
    }
    k.push(sum / (n - j));
  }
  return k;
};

export const getCorr = (randomVariable, Mu, D) => {
  let k = getCovar(randomVariable, Mu);
  return k.map(el => el / D);
};

export const getCorrData = (n, randomVariable, Mu, D) => {
  let k = getCorr(randomVariable, Mu, D);
  let data = [];

  for (let i = 1; i <= n; ++i) {
    let point = {
      x: i,
      y: k[i]
    };
    data.push(point);
  }
  return data;
};

export const getConfInterval = (evalMu, evalD, n, Mu) => {
  const left = evalMu - t * Math.sqrt(evalD / n);
  const right = evalMu + t * Math.sqrt(evalD / n);
  // console.log(`${left.toFixed(2)} <= ${Mu} <= ${right.toFixed(2)}`, left <= Mu && right >= Mu ? "interval OK" : "interval Wrong");
  return [left, right];
};

export const getSignificance = (evalMu, evalD, n, Mu) => {
  const Z = Math.abs(Math.sqrt(n) * (evalMu - Mu) / Math.sqrt(evalD));
  // console.log(Z.toFixed(2), Z < t ? "X0 OK" : "X0 Wrong");
  return Z;
};

// Юзаем встроенный в d3
// export const getHistogram = (randomVariable, k) => {
//   let n = randomVariable.length;
//   if (!k) k = 1.72 * Math.pow(n, 1/3);
//   let min = Math.min(...randomVariable);
//   let max = Math.max(...randomVariable);
//   let delta = (max - min) / k;
//   let histData = [];
//   for (let i = min; i < delta * k; i += delta) {
//     let quantity = 0;
//     for (let j of randomVariable) {
//       if (i <= j && j < i + delta) quantity++;
//     }
//     histData.push(quantity);
//   }
//   console.log(histData)
//  };

export const getK = (n) => Math.round(1.72 * Math.pow(n, 1 / 3));

const factorial = (x) => {
  if (x <= 1) return 1;
  let pr = 1;
  for (let i = 1; i <= x; ++i) {
    pr *= i;
  }
  return pr;
};

export const erlangLambda = (k, mean) => k / mean;
export const erlangD = (k, mean, lambda) => {
  if (mean && !lambda) return k / Math.pow(erlangLambda(k, mean), 2);
  if (!mean && lambda) return k / Math.pow(lambda, 2);
};

export const erlangPDF = (x, {k, mean}) => {
  // return (Math.pow(x, k - 1) * Math.exp(-x / Mu)) / (Math.pow(Mu, k) * factorial(k - 1))
  const lambda = k / mean;
  return (Math.pow(lambda, k) * Math.pow(x, k - 1) * Math.exp(-lambda * x)) / factorial(k - 1);
};

export const expLambda = (mean) => 1 / mean;
export const expD = (mean, lambda) => {
  if (mean && !lambda) return Math.pow(mean, 2);
  if (!mean && lambda) return Math.pow(lambda, -2);
};

export const expPDF = (x, {mean}) => {
  // console.log(mean)
  const lambda = 1 / mean;
  return lambda * Math.exp(-lambda * x);
};

export const normPDF = (x, {mean, D}) => {
  return (1 / Math.sqrt(2 * D * Math.PI)) * Math.exp(-(Math.pow(x - mean, 2)) / 2 * D);
};

export const getSumProbability = (randomVariable, intervals) => {
  let n = randomVariable.length;
  let min = Math.min(...randomVariable);
  let max = Math.max(...randomVariable);
  if (!intervals) {
    let delta = (max - min) / n;
    let sum = 0;
    for (let i = min; i < max; i += delta) {
      let quantity = 0;
      for (let j of randomVariable) {
        if (i <= j && j < i + delta) quantity++;
      }
      sum += quantity / n
    }
    return sum;
  } else {
    let sum = 0;
    for (let i = min, k = 0; k < intervals.length - 1; i += (intervals[k + 1] - intervals[k]), ++k) {
      let quantity = 0;
      for (let j of randomVariable) {
        if (i <= j && j < i + (intervals[k + 1] - intervals[k])) quantity++;
      }
      sum += quantity / n
    }
    return sum;
  }
};

function* rightEquiprobableBound(randomVariable, desiredP) {
  let n = randomVariable.length;
  let min = Math.min(...randomVariable);
  let max = Math.max(...randomVariable);
  let delta = (max - min) / n;
  let p = 0;
  for (let i = min; i < max; i += delta) {
    let quantity = 0;
    for (let j of randomVariable) {
      if (i <= j && j < i + delta) quantity++;
    }
    p += quantity / n;
    if (p >= desiredP) {
      p = 0;
      yield i;
    }
  }
}

const getQuantityInInterval = (randomVariable, interval) => {
  let quantity = 0;
  for (let j of randomVariable) {
    if (interval[0] <= j && j < interval[1]) quantity++;
  }
  return quantity;
};

const getIntegral = (interval, fn, args) => {
  let n = 1000;
  let min = Math.min(...interval);
  let max = Math.max(...interval);
  let delta = (max - min) / n;
  let sum = 0;
  for (let x = min; x < max; x += delta) {
    sum += fn(x, args) * delta;
  }
  return sum;
};

// const getPartialZ = ()

function* getIntervalNextBoundFromDesiredProbability(desiredP, fn, args) {
  const n = 10000;
  const sigma3 = 3 * args.mean + 3 * Math.sqrt(args.D);
  const delta = sigma3 / n;
  let p = 0;
  for (let x = 0; x < sigma3; x += delta) {
    p += fn(x, args) * delta;
    if (p >= desiredP) {
      yield [x, p];
      p = 0;
    }
  }
  yield [null, p];
}

export const chiSquareTest = (randomVariable, args) => {
  randomVariable = randomVariable.sort(compare);
  const n = randomVariable.length;
  const k = getK(randomVariable.length);

  const p = 1 / k;

  //let Psum = getSumProbability(randomVariable);
  // console.log(Psum)
  //let deltaP = Psum / k;
  let intervals = [randomVariable[0]];
  // const reb = rightEquiprobableBound(randomVariable, deltaP);
  // for (let i = 0; i < k; ++i) {
  //   let rightBound = reb.next().value;
  //   if (rightBound) intervals.push(rightBound);
  // }
  // intervals.push(randomVariable[n - 1]);
  //
  // console.log(args)
  // let sum = 0;
  // for (let i = 0; i < k; ++i) {
  //   sum += getIntegral([intervals[i], intervals[i + 1]], args.fn, args.args);
  // }

  const intervalsGenerator = getIntervalNextBoundFromDesiredProbability(p, args.fn, args.args);
  let pn = [];
  for (let i = 0; i < k; ++i) {
    let [interval, pi] = intervalsGenerator.next().value;
    intervals.push(interval);
    pn.push(pi);
  }
  // console.log(pn)
  if (!intervals[intervals.length - 1]) intervals[intervals.length - 1] = randomVariable[randomVariable.length - 1];

  let fallingsIntoIntervals = [];
  for (let i = 0; i < k; ++i) {
    let val = getQuantityInInterval(randomVariable, [intervals[i], intervals[i + 1]]);
    fallingsIntoIntervals.push(val);
  }

  let Z = 0;
  for (let i = 0; i < k; ++i) {
    Z += Math.pow(fallingsIntoIntervals[i] - n * pn[i], 2) / (n * pn[i]);
  }
  // Проверка плотности вероятности во всех полученных интервалах, должна быть такая же, как и Psum
  // console.log(getSumProbability(randomVariable, intervals))
  return Z;
};

export const getGiscreteHist = (randomVariable, discreteN, {fn, args}) => {
  let arr = [];
  for (let i = 1; i <= discreteN; ++i) {
    arr.push({
      quantity: 0,
      x: i
    })
  }
  console.log(arr)
  for (let i = 0; i < randomVariable.length; ++i) {
    let curr = randomVariable[i];
    arr[curr - 1].quantity++;
    console.log(i)
  }
  arr = arr.map((el, i) => {
    el.l = el.quantity / randomVariable.length;
    el.y = fn(el.x, args);
    return el;
  });
  return arr;
};

export const getDistHist = (randomVariable, Pi) => {
  let discreteN = Pi.length;
  let arr = [];
  for (let i = 1; i <= discreteN; ++i) {
    arr.push({
      quantity: 0,
      x: i
    })
  }
  for (let i = 0; i < randomVariable.length; ++i) {
    let curr = randomVariable[i];
    arr[curr - 1].quantity++;
  }
  arr = arr.map((el, i) => {
    el.l = el.quantity / randomVariable.length;
    el.y = Pi[i]
    return el;
  });
  return arr;
};