/* eslint-disable */
export const m = Math.pow(2, 31) - 1;
const a = 48271;

// Линейный конгруэнтный генератор
export function* linMultGen(initVal, M, A) {
  let val = initVal ? initVal : 1;
  if (!M) {
    M = m;
  }
  if (!A) {
    A = a;
  }
  while (true) {
    val = (a * val) % m;
    yield val;
  }
}

const lmg = linMultGen();

// Генератор равномерно распределенной СВ
export function* uniDistrib(seed) {
  let localLMG;
  if (seed) {
    localLMG= linMultGen(seed);
  } else {
    localLMG = lmg;
  }
  while (true) {
    const val = localLMG.next().value;
    yield val / m;
  }
}

const ud = uniDistrib();

// Генератор экспоненциального распределения
export function* expDistrib({Mu}, seed) {
  let localUD;
  if (seed) {
    localUD = uniDistrib(seed);
  } else {
    localUD = ud;
  }
  while (true) {
    const val = localUD.next().value;
    yield -Mu * Math.log(val);
  }
}

// Генератор распределения Эрланга
export function* erlangDistrib({Mu, k}, seed) {
  let localUD;
  if (seed) {
    localUD = uniDistrib(seed);
  } else {
    localUD = ud;
  }
  while (true) {
    let pr = 1;
    for (let i = 0; i < k; ++i) {
      pr *= localUD.next().value;
    }
    // Mu = k / L
    // L = k / Mu
    // -1 / L
    // -(k / L)/k = -1/L
    yield (-Mu/ k) * Math.log(pr);
  }
}

// Генератор для генераторов
export function* genericGenerator(gen, n, seed, args) {
  const genInstance = gen(args, seed);
  for (let i = 0; i < n; ++i)
    yield genInstance.next().value;
}


// Генератор нормально распределенной СВ методом Бокса-Мюллера
export function* normDistrib({Mu, D}, seed) {
  Mu = Mu ? Mu : 0;
  D = D ? D : 1;
  while (true) {
    const val1 = ud.next().value;
    const val2 = ud.next().value;
    yield  Mu + D * (Math.sqrt(-2 * Math.log(val1)) * Math.sin(2 * Math.PI * val2));
  }
}

export function* logNormDistrib({Mu, D}, seed) {
  let logMu = Math.log(Math.pow(Mu, 2) / Math.sqrt(Math.pow(Mu, 2) + D));
  let logD = Math.log(1 + D / Math.pow(Mu, 2));
  const nd = normDistrib({Mu: logMu, D: logD});
  while (true) {
    yield Math.exp(nd.next().value);
  }
}

// Нам не нужно нормальное распределение, будем юзать экспоненциальное
// let normDistributionGen = genericGenerator(normDistrib, N, [Ms, [M1, A1], [M2, A2]]);
// let randomVariableNorm = [...normDistributionGen];
// console.log(randomVariableNorm);

export function* discreteDistrib(gen, n, discreteN, args) {
  const ed = gen(args);
  let expontentialDistribution = [];
  for (let i = 0; i < n; ++i)
    expontentialDistribution.push(ed.next().value);
  const max = Math.max(...expontentialDistribution);
  const min = Math.min(...expontentialDistribution);
  let delta = (max - min) / discreteN;
  // console.log(delta, max)
  for (let i = 0; i <= n; ++i) {
    for (let j = 1; j <= discreteN; ++j) {
      let curr = expontentialDistribution[i];
      if (curr >= delta * (j - 1) && curr <= delta * j) {
        yield j;
        break;
      }
    }

    // let sum = 0;
    // for (let x = min, j = 1; j <= discreteN; x += delta, ++j) {
    //   let curr = expontentialDistribution[i];
    //   if (curr >= x & curr < x + delta) {
    //     yield j;
    //     break;
    //   }
    // }
  }
}

export function* disDist(gen, n, seed, Pi, args) {
  const UD = gen(seed);
  const discreteN = Pi.length;
  let udist = [];
  for (let i = 0; i < n; ++i)
    udist.push(UD.next().value);
  const max = Math.max(...udist);
  const min = Math.min(...udist);
  let Yi = [0];
  for (let i = 0; i < discreteN; ++i) {
    Yi.push(Yi[i] + Pi[i]);
  }
  for (let i = 0; i <= n; ++i) {
    for (let j = 0; j < discreteN; ++j) {
      let curr = udist[i];
      if (curr > Yi[j] && curr <= Yi[j + 1]) {
        yield j + 1;
        break;
      }
    }
  }
}