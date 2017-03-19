/* eslint-disable */
import * as d3 from "d3";
import * as utils from '../lib/utils';
import d3Wrap from 'react-d3-wrap';

const getTicks = (randomVariable, k) => {
  let n = randomVariable.length;
  let min = Math.min(...randomVariable);
  let max = Math.max(...randomVariable);
  let delta = (max - min) / k;
  let ticks = [];
  for (let i = min; i < max; i += delta) {
    ticks.push(i);
  }
  return ticks;
};

export default d3Wrap({
  initialize (svg, data, options) {
    // Optional initialize method called once when component mounts
  },

  update (svgEl, data, options) {
    const min = Math.min(...data), max = Math.max(...data);
    const k = options.k ? options.k : utils.getK(data.length);

    let formatCount = d3.format(",.0f");

    let svg = d3.select(svgEl);
    let margin = {
      top: 10, right: 0, bottom: 30, left: 60
    };
    let width = +svg.attr("width") - margin.left - margin.right;
    let height = +svg.attr("height") - margin.top - margin.bottom;
    let g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

    let x = d3.scaleLinear()
      .domain([min, max])
      .rangeRound([0, width]);

    let ticks = getTicks(data, k);
    let bins = d3.histogram()
      .domain(x.domain())
      // .thresholds(x.ticks(20))(data);
      .thresholds(ticks)(data);

    let delta = (Math.max(...ticks) - Math.min(...ticks)) / k;

    let y = d3.scaleLinear()
      .domain([0, d3.max(bins, function (d) {
        return d.length / data.length / delta;
      })])
      .range([height, 0]);

    let bar = g.selectAll(".bar")
      .data(bins)
      .enter().append("g")
      .attr("class", "bar")
      .attr("transform", function (d) {
        return `translate(${x(d.x0)}, ${y(d.length / data.length / delta)})`;
      });

    bar.append("rect")
      .style('fill', options.color)
      .attr("x", 1)
      .attr("width", width/bins.length/1.2)
      .attr("height", function (d) {
        return height - y(d.length / data.length / delta);
      });

    if (options.line) {
      let valueline = d3.line()
        .x(function (xd) {
          return x(xd);
        })
        .y(function (xd) {
          const yd = options.line.fn(xd, options.line.args);
          return y(yd);
        });

      g.append("path")
        .data([getTicks(data, 100)])
        .attr("class", "line")
        .attr("d", valueline);
    }

    g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x));

    g.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(y));
  },

  destroy () {
    // Optional clean up when a component is being unmounted...
  }
})