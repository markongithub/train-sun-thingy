"use strict";
var geojson = require('geojson');
var geojsonExtent = require('@mapbox/geojson-extent');
var gtfs = require('gtfs');
var moment = require('moment-timezone');
var suncalc = require('suncalc');

var exports = module.exports = {};

process.on('unhandledRejection', function onError(err) {
     throw err;
});

function shapesForStoptimePair (stopT1, stopT2, stops, shapes) {
  if (useShapeDistance(stopT1, stopT2, shapes)) {
    return shapesForStoptimePairUsingDist(stopT1, stopT2, shapes);
  }
  return shapesForStoptimePairUsingLatLon(stopT1, stopT2, stops, shapes);
}
exports.shapesForStoptimePair = shapesForStoptimePair;

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
  if (startShapeIndex === undefined) {
    throw "I never found the start index.";
  }
  if (endShapeIndex === undefined) {
    // This happens on Atlantic City Line trips to Philly.
    console.log("I never found the last shape. That's not great. Is this " +
                "the Atlantic City line?");
    endShapeIndex = shapes.length - 1;
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

function fakeShapeFromStop(stop) {
  return { shape_pt_lat: stop.stop_lat, shape_pt_lon: stop.stop_lon }
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
  if (shapes === undefined || shapes.length < 1) {
    // It's not you I hate, Amtrak. I hate what I became because of you.
    return [fakeShapeFromStop(stop1), fakeShapeFromStop(stop2)];
  }
  var shape1 = shapeIndexNearestToStop(stop1, shapes);
  var shape2 = shapeIndexNearestToStop(stop2, shapes);
  if (shape1 >= shape2) {
    throw "The shapes are out of order.";
  }
  return shapes.slice(shape1, shape2 + 1);
}

function vehicleHeading (shape1, shape2) {
  // console.log("heading from " + shape1.loc + " to " + shape2.loc);
  var dy = shape2.shape_pt_lat - shape1.shape_pt_lat;
  var dx = shape2.shape_pt_lon - shape1.shape_pt_lon;
  return atan2ToSuncalc(Math.atan2(dy, dx));
}

function atan2ToSuncalc (radians) {
  // Okay. suncalc returns azimuths as radians west of south. Math.atan2 counts
  // radians north of east. Both can go negative. All my math is wrong.
  // So I need to multiply the atan2 output by -1, then subtract pi/2, then
  // mod by 2pi. Right?
  // return modJavascriptWhyWhyWhy((-1 * radians) - (Math.PI / 2), Math.PI * 2);
  // Wrong. Fuck.
  // OK. No mod.
  if (radians < (Math.PI / 2)) {
    return ((Math.PI * -1 / 2) - radians);
  }
  else {
    return ((Math.PI * 3 / 2) - radians);
  }
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

function transitTimeToRealDate (dateObj, timeStr, timeZone) {
  // If we pass in a time that's after midnight, this code kills all humans.
  if (timeZone === undefined) throw new Error("You must specify a time zone.");
  var hourMinSec = timeStr.split(':'); // Also assuming this works!
  var momentArray = [
    dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hourMinSec[0],
    hourMinSec[1], hourMinSec[2]];
  // console.log(momentArray);
  return new Date(moment.tz(momentArray, timeZone));
}
exports.transitTimeToRealDate = transitTimeToRealDate;

function addWhyDoIHaveToWriteThis (x, y) {
  return x + y;
}

function durationsForShapeList (stopT1, stopT2, shapes, dateObj, timeZone) {
  var segmentDistances = new Array(shapes.length - 1);
  for (var i=0; i < (shapes.length - 1); i++) {
    segmentDistances[i] =  segmentDistance(shapes[i], shapes[i+1]);
  }
  var totalDistance = segmentDistances.reduce(addWhyDoIHaveToWriteThis);
  var segmentFractions = segmentDistances.map(d => d / totalDistance);
  var dateA = transitTimeToRealDate(dateObj, stopT1.departure_time, timeZone);
  var dateB = transitTimeToRealDate(dateObj, stopT2.departure_time, timeZone);
  var duration = dateB - dateA;
  var segmentDurations = segmentFractions.map(f => f * duration);
  return segmentDurations;
}
exports.durationsForShapeList = durationsForShapeList;

var sunStatus = {
  LEFT: 0,
  RIGHT: 1,
  CENTER: 2,
  DARK: 3
}
exports.sunStatus = sunStatus;

function sunnySideVerdict(statuses) {
  if (statuses[sunStatus.LEFT] == statuses[sunStatus.RIGHT]) {
    if (statuses[sunStatus.LEFT] || statuses[sunStatus.CENTER]) {
      return ("both sides of the vehicle get equal sunlight during this trip " +
              "-- but this is most likely a miscalculation on our part.");
    }
    else {
      return "the sun is below the horizon for this trip.";
    }
  }
  else if (statuses[sunStatus.LEFT] > statuses[sunStatus.RIGHT]) {
    return "this trip has more sunlight on the left side of the vehicle.";
  }
  else return "this trip has more sunlight on the right side of the vehicle.";
}
exports.sunnySideVerdict = sunnySideVerdict;

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
  // console.log("heading " + heading + " sun " + azimuth);
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


function sunTimesForStoptimePair(stoptime1, stoptime2, allStops, allShapes,
                                 dateObj, timeZone) {
  var statusTime = new Array(Object.keys(sunStatus).length).fill(0);
  var shapes = shapesForStoptimePair(stoptime1, stoptime2, allStops, allShapes);
  console.assert(shapes.length > 1, "Insufficient shapesForStoptimePair");
  var durations = durationsForShapeList(stoptime1, stoptime2, shapes,
                                        dateObj, timeZone);
  console.assert(shapes.length == durations.length + 1,
                 "I suspect I am about to crash.");
  var startTime = transitTimeToRealDate(
    dateObj, stoptime1.departure_time, timeZone);
  for (var i = 0; i < durations.length; i++) {
    var endTime = new Date(startTime.getTime() + durations[i]);
    var segmentResult = sunStatusForSegment(startTime, endTime,
                                            shapes[i], shapes[i+1]);
    // console.log(durations[i] + " ms with sunStatus " + segmentResult);

    statusTime[segmentResult] += Math.round(durations[i]); // nearest ms?
    startTime = endTime;
  }
  return statusTime;
}
exports.sunTimesForStoptimePair = sunTimesForStoptimePair;

function sunDetailsForStoptimePair(stoptime1, stoptime2, allStops, allShapes,
                                   dateObj, timeZone) {
  var shapes = shapesForStoptimePair(stoptime1, stoptime2, allStops, allShapes);
  console.assert(shapes.length > 1, "Insufficient shapesForStoptimePair");
  var durations = durationsForShapeList(stoptime1, stoptime2, shapes,
                                        dateObj, timeZone);
  var results = new Array(durations.length);
  console.assert(shapes.length == durations.length + 1,
                 "I suspect I am about to crash.");
  var startTime = transitTimeToRealDate(
    dateObj, stoptime1.departure_time, timeZone);
  for (var i = 0; i < durations.length; i++) {
    var endTime = new Date(startTime.getTime() + durations[i]);
    var segmentResult = sunStatusForSegment(startTime, endTime,
                                            shapes[i], shapes[i+1]);
    results[i] = { line: [
      [shapes[i].shape_pt_lon, shapes[i].shape_pt_lat],
      [shapes[i+1].shape_pt_lon, shapes[i+1].shape_pt_lat]],
                   sunStatus: segmentResult };
  }
  return results;
  //return geojson.parse(results, {'LineString': 'line'});
}
exports.sunDetailsForStoptimePair = sunDetailsForStoptimePair;

function stoptimesAlongRoute(stopID1, stopID2, routeStoptimes,
                             allStops, allShapes) {
  var result = [];
  var onRoute = false;
  for (var i = 0; i < routeStoptimes.length; i++) {
    if (routeStoptimes[i].stop_id == stopID2) {
      if (result.length < 1) throw "Found end stop before first, that is bad.";
      result.push(routeStoptimes[i]);
      return result;
    }

    if ((routeStoptimes[i].stop_id == stopID1) ||
        (parentStop.get(routeStoptimes[i].stop_id) == stopID1)) {
      onRoute = true;
    }
    if (onRoute) {
      result.push(routeStoptimes[i]);
    }
  }
  throw ("We didn't find our two stopIDs in the stop times.");
}

function addObjects(o1, o2) {
  // This function assumes o1 and o2 have the same keys and kills all humans
  // if they do not.
  var result = new Object();
  var keys =  Object.keys(o1);
  for (var i=0; i < keys.length; i++) {
    var key = keys[i];
    result[key] = o1[key] + o2[key];
  }
  return result;
}

function sunStatusAlongRoute(stopID1, stopID2, routeStoptimes,
                             allStops, allShapes, dateObj, timeZone) {
  var curStatus = new Array(Object.keys(sunStatus).length).fill(0);
  var stoptimes = stoptimesAlongRoute(stopID1, stopID2, routeStoptimes,
                                      allStops, allShapes);
  if (stoptimes.length < 2) throw "found less than 2 stoptimes on route.";
  for (var i=1; i < stoptimes.length; i++) {
    var nextStatus = sunTimesForStoptimePair(
      stoptimes[i-1], stoptimes[i], allStops, allShapes, dateObj, timeZone);
    curStatus = addObjects(curStatus, nextStatus);
  }
  return curStatus;
}
exports.sunStatusAlongRoute = sunStatusAlongRoute;

function sunDetailsAlongRoute(stopID1, stopID2, routeStoptimes,
                             allStops, allShapes, dateObj, timeZone) {
  var result = new Array();
  var stoptimes = stoptimesAlongRoute(stopID1, stopID2, routeStoptimes,
                                      allStops, allShapes);
  if (stoptimes.length < 2) throw "found less than 2 stoptimes on route.";
  for (var i=1; i < stoptimes.length; i++) {
    var curDetails = sunDetailsForStoptimePair(
      stoptimes[i-1], stoptimes[i], allStops, allShapes, dateObj, timeZone);
    result = result.concat(curDetails);
  }
  return geojson.parse(result, {'LineString': 'line'});
  // return result;
}
exports.sunDetailsAlongRoute = sunDetailsAlongRoute;

// if I have a tripID
// I can get shapes
// I can get stoptimes
// from the stoptimes I can get stops

function getStoptimesThenStopsP (agencyKey, tripID) {
  // This is my first ever attempt at JS promises. I am sorry.
  return gtfs.getStoptimes({agency_key: agencyKey, trip_id: tripID})
  .then(stoptimes => {
    var stopIDs = stoptimes.map(o => o.stop_id);
    // I don't think this getStops call needs to worry about parent_stations.
    return gtfs.getStops({agency_key: agencyKey, stop_id: {$in: stopIDs}})
    .then(stops => [stoptimes, stops]);
  });
}

function getAllTripDataP (agencyKey, tripID) {
  var p1 = gtfs.getShapes({agency_key: agencyKey, trip_id: tripID});
  var p2 = getStoptimesThenStopsP(agencyKey, tripID);
  var p3 = getTimeZoneForAgencyP(agencyKey);
  return Promise.all([p1, p2, p3]).then(results => {
    if ((results.length != 3) || (results[1].length != 2)) {
      throw "I got back a weird array size from GTFS."
    }
    const output = { shapes: results[0],
                     stoptimes: results[1][0],
                     stops: results[1][1],
                     timeZone: results[2] };
    var outputStats = (
      output.stoptimes.length + " stoptimes, " + output.stops.length +
      " stops, time zone " + output.timeZone + ", " + output.shapes.length);
    if (output.shapes.length > 0) {
      outputStats += ("x" + output.shapes[0].length);
    }
    outputStats += " shapes";
    console.log(outputStats);
    return output;
  });
}
exports.getAllTripDataP = getAllTripDataP;

function dateRange(startDate, days) {
  var result = new Array(days);
  var nextDate = startDate;
  for (var i=0; i < days; i++) {
    result[i] = new Date(nextDate);
    nextDate.setDate(nextDate.getDate() + 1);
  }
  return result;
}
exports.dateRange = dateRange;

function getYearOfTripsP(agencyKey, tripID, startDate, fromStop, toStop) {
  const tripDataP = getAllTripDataP(agencyKey, tripID);
  return tripDataP.then(tripData => {
    console.log("Working on time zone " + tripData.timeZone);
    var dates = dateRange(startDate, 365); // Sucks if it's a leap year.
    var result = new Array(365);
    for (var i=0; i< dates.length; i++) {
      result[i] = {
        date: dates[i],
        sunStatus : sunStatusAlongRoute(
          fromStop, toStop, tripData.stoptimes, tripData.stops,
          tripData.shapes[0], dates[i], tripData.timeZone)};
    }
    return result;
  });
}
exports.getYearOfTripsP = getYearOfTripsP;

function getDetailsForTripP(agencyKey, tripID, startDate, fromStop, toStop) {
  const tripDataP = getAllTripDataP(agencyKey, tripID);
  return tripDataP.then(tripData => {
    console.log("Working on time zone " + tripData.timeZone);
    const geojson = sunDetailsAlongRoute(
      fromStop, toStop, tripData.stoptimes, tripData.stops,
      tripData.shapes[0], startDate, tripData.timeZone);
    return geojsonExtent.bboxify(geojson);
  });
}
exports.getDetailsForTripP = getDetailsForTripP;

function formatMultiDayResults(results) {
  var curVerdict = sunnySideVerdict(results[0].sunStatus);
  var segmentStarted = results[0].date.toDateString();
  var output = "";
  for (var i=1; i < results.length; i++) {
    var newVerdict = sunnySideVerdict(results[i].sunStatus);
    if ((i == (results.length - 1)) || (newVerdict != curVerdict)) {
      var newOutput = (
        "From " + segmentStarted + " through " +
        results[i-1].date.toDateString() + ", " + curVerdict + "<BR>");
      output += newOutput;
      curVerdict = newVerdict;
      segmentStarted = results[i].date.toDateString();
    }
  }
  return output;
}
exports.formatMultiDayResults = formatMultiDayResults;

function getYearVerdictAjaxP(
  agencyKey, tripID, startDate8601, fromStop, toStop) {
  const startDate = new Date(startDate8601);
  return getYearOfTripsP(agencyKey, tripID, startDate, fromStop, toStop).then(
    formatMultiDayResults);
}
exports.getYearVerdictAjaxP = getYearVerdictAjaxP;

function getGeoJSONAjaxP(
  agencyKey, tripID, startDate8601, fromStop, toStop) {
  const startDate = new Date(startDate8601);
  return getDetailsForTripP(agencyKey, tripID, startDate, fromStop, toStop);
}
exports.getGeoJSONAjaxP = getGeoJSONAjaxP;

function getServicesForDateP(agencyKey, dateObj) {
  const dateYYYYMMDD = [dateObj.getFullYear(),dateObj.getMonth() + 1,
                        dateObj.getDate()].join('');
  console.log(dateYYYYMMDD);
  const dayOfWeekLC = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday',
                       'friday', 'saturday'][dateObj.getDay()]
  var calendarReq = {
    agency_key: agencyKey, start_date: {$lte: dateYYYYMMDD},
    end_date: {$gte: dateYYYYMMDD}};
  calendarReq[dayOfWeekLC] = 1;
  if (agencyKey == "septa-rail") {
    // We have to special case this stuff because of leading spaces that
    // violate the GTFS spec. Philadelphia freedom, I love you. Yes I do.
    calendarReq = {agency_key: agencyKey};
    calendarReq[" start_date"] = {$lte: dateYYYYMMDD};
    calendarReq[" end_date"] =  {$gte: dateYYYYMMDD};
    calendarReq[" " + dayOfWeekLC] = "1";
  }
  const calendarP = gtfs.getCalendars(calendarReq);
  const calendarDateP = gtfs.getCalendarDates({
    agency_key: agencyKey, date: dateYYYYMMDD});
  return Promise.all([calendarP, calendarDateP]).then(results => {
    var services = new Set(results[0].map(o => o.service_id));
    for (var i=0; i<results[1].length; i++) {
      const exceptionService = results[1][i].service_id;
      if (results[1][i].exception_type == 1) {
        // console.log("Calendar exception: adding service " + exceptionService);
        services.add(exceptionService);
      }
      else if (results[1][i].exception_type == 2) {
        // console.log("Calendar exception: deleting service " + exceptionService);
        services.delete(exceptionService);
      }
      else console.error("Invalid exception_type: " +
                         results[1][i].exception_type);
    }
    return Array.from(services);
  });
}
exports.getServicesForDateP = getServicesForDateP;

function getStoptimesForStopAndDateP(agencyKey, stopID, dateObj) {
  return getServicesForDateP(agencyKey, dateObj).then(serviceIDs => {
    if (serviceIDs.length < 1) {
      console.error("No service for this date: " + dateObj + " Or it is SEPTA's fault.");
    }
    // We have to get all the children of stopID, if it has any. Then we return
    // stoptimes for both the parent and the children.
    return gtfs.getStops({
      agency_key: agencyKey,
      parent_station: stopID }).then(childStops => {
      const possibleStopIDs = childStops.map(s => s.stop_id).concat([stopID]);
      console.log("Possible stop IDs: " + possibleStopIDs);
      return gtfs.getStoptimes({
        agency_key: agencyKey,
        stop_id: {$in: possibleStopIDs},
        service_id: {
          $in: serviceIDs
        }
      });
    });
  });
}
exports.getStoptimesForStopAndDateP = getStoptimesForStopAndDateP;

function combineStoptimeWithTripP(stoptime) {
  const tripsP = gtfs.getTrips({
    agency_key: stoptime.agency_key,
    trip_id: stoptime.trip_id})
  return tripsP.then(trips => {
    console.assert(trips.length == 1,
                  "I expected to get only one trip back. This is bad.");
    const trip = trips[0];
    return { trip_id: trip.trip_id,
             departure_time: stoptime.departure_time,
             trip_headsign: trip.trip_headsign,
             block_id: trip.block_id }
  });
}

function formatAjaxDeparture(departure) {
  var departure_desc = departure.departure_time;
  if (departure.block_id) departure_desc += (" #" + departure.block_id);
  if (departure.trip_headsign) departure_desc += (
    " toward " + departure.trip_headsign);
  return { trip_id: departure.trip_id,
           departure_desc: departure_desc }
}

function sortByDepartureDesc(departures) {
  return departures.sort(function (a, b) {
    if (a.departure_desc < b.departure_desc) return -1;
    if (a.departure_desc > b.departure_desc) return 1;
    return 0;
  });
}
function getDeparturesForStopAndDateAjaxP(agencyKey, stopID, date8601) {
  const dateObj = new Date(date8601);
  return getDeparturesForStopAndDateP(agencyKey, stopID, dateObj).then(
    departures => {
      const output = sortByDepartureDesc(departures.map(formatAjaxDeparture));
      return output;
    });
}
exports.getDeparturesForStopAndDateAjaxP = getDeparturesForStopAndDateAjaxP;

function getDeparturesForStopAndDateP(agencyKey, stopID, dateObj) {
  const stoptimesP = getStoptimesForStopAndDateP(agencyKey, stopID, dateObj);
  return stoptimesP.then(
    stoptimes => Promise.all(stoptimes.map(combineStoptimeWithTripP)));
}
exports.getDeparturesForStopAndDateP = getDeparturesForStopAndDateP;

function stopIDAndName(stop) {
  return {stop_id: stop.stop_id, stop_name: stop.stop_name};
}

function sortByStopName(stops) {
  return stops.sort(function (a, b) {
    if (a.stop_name < b.stop_name) return -1;
    if (a.stop_name > b.stop_name) return 1;
    return 0;
  });
}
function getSourceStopsP(agencyKey) {
  // parent_station could be an empty string, or not there at all.
  return gtfs.getStops({agency_key: agencyKey,
                        parent_station: {$in: [undefined, ""]}}).then(
    stops => sortByStopName(stops.map(stopIDAndName)));
}
exports.getSourceStopsP = getSourceStopsP;

function lookupStopNameP(agencyKey, stopID) {
  return gtfs.getStops({agency_key: agencyKey, stop_id: stopID}).then(stops => {
    console.assert(stops.length == 1, "I expected exactly one stop.");
    return stopIDAndName(stops[0]);
  });
}

function getSubsequentStopsP(agencyKey, stopID, tripID) {
  return gtfs.getStoptimes({agency_key: agencyKey,
                            trip_id: tripID}).then(stoptimes => {
    // stopID is a parent. But these stoptimes point to children.
    const allStopIDsOnTrip = stoptimes.map(o => o.stop_id);
    return gtfs.getStops(
      {agency_key: agencyKey, stop_id: {$in: allStopIDsOnTrip}}).then(stops => {
      var stopsByStopID = {};
      for (var i=0; i < stops.length; i++) {
        stopsByStopID[stops[i].stop_id] = stops[i];
      }
      const startIndex = stoptimes.findIndex(
        st => (st.stop_id == stopID ||
               stopsByStopID[st.stop_id].parent_station == stopID));
      const remainingStoptimes = stoptimes.slice(startIndex + 1);
      const output = remainingStoptimes.map(st => (
        {stop_id: st.stop_id,
         stop_name: stopsByStopID[st.stop_id].stop_name}));
      return output;
    });
  });
}
exports.getSubsequentStopsP = getSubsequentStopsP;

function getAgencyKeysP() {
  return gtfs.getAgencies().then(agencies => Array.from(new Set(agencies.map(
    a => a.agency_key))));
}
exports.getAgencyKeysP = getAgencyKeysP;

function getTimeZoneForAgencyP(agencyKey) {
  return gtfs.getAgencies({agency_key: agencyKey}).then(agencies => {
    if (agencies.length < 1) throw new Error(
      "Agency key not found: " + agencyKey);
    if (agencies[0].agency_timezone === undefined) {
      console.log(agencyKey + " has no timezone set, defaulting to Eastern.");
      return "US/Eastern";
    }
    return agencies[0].agency_timezone;
  });
}
