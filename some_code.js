"use strict";
var moment = require('moment-timezone');
var suncalc = require('suncalc');

var exports = module.exports = {};

exports.shapesForStoptimePair = function (
  stopT1, stopT2, stops, shapes) {
  if (useShapeDistance(stopT1, stopT2, shapes)) {
    return shapesForStoptimePairUsingDist(stopT1, stopT2, shapes);
  }
  return shapesForStoptimePairUsingLatLon(stopT1, stopT2, stops, shapes);
}

function useShapeDistance (stopT1, stopT2, shapes) {
  if (stopT1.shape_dist_traveled === undefined ||
      stopT2.shape_dist_traveled === undefined) {
    return false;
  }
  for (var i = 1; i < shapes.length; i++){
    if (shapes[i].shape_dist_traveled === undefined) {
      return false;
    }
  }
  return true;
}

function shapesForStoptimePairUsingDist(st1, st2, shapes) {
  // can I assume shapes is sorted? I shall assume that. And regret it.
  var startShapeDistance = st1.shape_dist_traveled;
  var endShapeDistance = st2.shape_dist_traveled;
  var startShapeIndex;
  var endShapeIndex;
  for (var i = 1; i < shapes.length; i++){
    if (startShapeIndex === undefined && shapes[i].shape_dist_traveled >= startShapeDistance){
      startShapeIndex = i - 1;
      continue;
    }
    if (shapes[i].shape_dist_traveled >= endShapeDistance) {
      endShapeIndex = i;
      break;
    }
  }
  if (startShapeIndex === undefined || endShapeIndex === undefined) {
    throw "I failed to find the start and end indices.";
  }
  return shapes.slice(startShapeIndex, endShapeIndex);
}

function latLonDistance (lat1, lon1, lat2, lon2) {
  var dy = Math.abs(lat1 - lat2)
  var dx = Math.abs(lon1 - lon2)
  return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2))
}

function shapeIndexNearestToStop (stop, shapes) {
  var bestDistance = Infinity;
  var bestIndex;
  for (var i = 0; i < shapes.length; i++) {
    var curDistance = latLonDistance(stop.stop_lat, stop.stop_lon,
                                     shapes[i].shape_pt_lat,
                                     shapes[i].shape_pt_lon);
    if (curDistance < bestDistance) {
      bestDistance = curDistance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function shapesForStoptimePairUsingLatLon (
  stopT1, stopT2, stops, shapes) {
  var stop1, stop2;
  for (var i = 0; i< stops.length; i++) {
    if (stops[i].stop_id == stopT1.stop_id) {
      stop1 = stops[i];
    }
    if (stops[i].stop_id == stopT2.stop_id) {
      stop2 = stops[i];
    }
  }
  if (stop1 === undefined || stop2 === undefined) {
    throw "I failed to find the two stop times in the stops array";
  }
  var shape1 = shapeIndexNearestToStop(stop1, shapes);
  var shape2 = shapeIndexNearestToStop(stop2, shapes);
  if (shape1 >= shape2) {
    throw "The shapes are out of order.";
  }
  return shapes.slice(shape1, shape2);
}

function vehicleHeading (shape1, shape2) {
  // console.log("heading from " + shape1.loc + " to " + shape2.loc);
  var dy = shape2.shape_pt_lat - shape1.shape_pt_lat;
  var dx = shape2.shape_pt_lon - shape1.shape_pt_lon;
  return atan2ToSuncalc(Math.atan2(dy, dx));
}

function atan2ToSuncalc (radians) {
  // Okay. suncalc returns azimuths as radians west of south. Math.atan2 counts
  // radians north of east and can go negative. Unifying these is hard.
  // So I need to multiply the atan2 output by -1, then subtract pi/2, then
  // mod by 2pi. Right?
  return modJavascriptWhyWhyWhy((-1 * radians) - (Math.PI / 2), Math.PI * 2);
}
exports.atan2ToSuncalc = atan2ToSuncalc;

function segmentDistance (shape1, shape2) {
  return latLonDistance (shape1.shape_pt_lat, shape1.shape_pt_lon,
                         shape2.shape_pt_lat, shape2.shape_pt_lon);
}

function segmentMidpoint (shape1, shape2) {
  return [(shape1.shape_pt_lat + shape2.shape_pt_lat) / 2.0,
          (shape1.shape_pt_lon + shape2.shape_pt_lon) / 2.0]
}

exports.transitTimeToRealDate = function (timeStr) {
  // For now we are hard coding a date. And hard coding the fact that
  // everything is US/Eastern. But at least we are not hard coding whether it
  // is EST or EDT!
  var hourMinSec = timeStr.split(':'); // Also assuming this works!
  return new Date(moment.tz([2017, 10, 5, hourMinSec[0],
                             hourMinSec[1], hourMinSec[2]], "US/Eastern"));
}

function addWhyDoIHaveToWriteThis (x, y) {
  return x + y;
}

exports.durationsForShapeList = function (
  stopT1, stopT2, shapes) {
  var segmentDistances = new Array(shapes.length - 1);
  for (var i=0; i < (shapes.length - 1); i++) {
    segmentDistances[i] =  segmentDistance(shapes[i], shapes[i+1]);
  }
  var totalDistance = segmentDistances.reduce(addWhyDoIHaveToWriteThis);
  var segmentFractions = segmentDistances.map(d => d / totalDistance);
  var dateA = exports.transitTimeToRealDate(stopT1.departure_time);
  var dateB = exports.transitTimeToRealDate(stopT2.departure_time);
  var duration = dateB - dateA;
  var segmentDurations = segmentFractions.map(f => f * duration);
  return segmentDurations;
}

var sunStatus = {
  LEFT: 0,
  RIGHT: 1,
  CENTER: 2,
  DARK: 3
}
exports.sunStatus = sunStatus;

function sunStatusForSegment (startDate, endDate, startShape, endShape) {
  // console.log(startDate + " " + endDate);
  var sunLocation = segmentMidpoint(startShape, endShape);
  var sunTime = (startDate.getTime() + endDate.getTime()) / 2;
  var heading = vehicleHeading(startShape, endShape);
  // console.log("heading " + heading);
  var sunData = suncalc.getPosition(sunTime, sunLocation[0], sunLocation[1]);
  // console.log(sunLocation + " " + sunTime);
  // console.log(sunData);
  if (sunData.altitude < 0) return sunStatus.DARK;
  return relativeToHeading(heading, sunData.azimuth);
}
exports.sunStatusForSegment = sunStatusForSegment;

// https://stackoverflow.com/questions/4467539/javascript-modulo-gives-a-negative-result-for-negative-numbers
function modJavascriptWhyWhyWhy(n, m) {
        return ((n % m) + m) % m;
}

function relativeToHeading (heading, azimuth) {
  var oppositeDirection = (heading + Math.PI) % (Math.PI * 2);
  // This is highly unlikely but why not.
  if (azimuth == heading ||
      azimuth == oppositeDirection) return sunStatus.CENTER;
  var d = modJavascriptWhyWhyWhy(heading - azimuth, Math.PI * 2);
  if (d < Math.PI) {
    return sunStatus.LEFT;
  }
  return sunStatus.RIGHT;
}
exports.relativeToHeading = relativeToHeading;
/*
  var segmentStartTimes = new Array(segmentDurations.length);
  segmentStartTimes[0] = dateA;
  for (var i=1; i < segmentDurations.length; i++) {
    segmentStartTimes[i] = segmentStartTimes[i-1] + segmentDurations[i-1];
  }
  return segmentStartTimes;
}

Divide the segment into one-second segments.
Maybe they should be milliseconds?
*/
