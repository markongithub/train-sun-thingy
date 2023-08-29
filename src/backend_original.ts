"use strict";
import geojson from 'geojson';
import * as geojsonExtent from '@mapbox/geojson-extent';
import * as gtfs from 'gtfs';
import moment from 'moment-timezone';
import suncalc from 'suncalc';

export { getDates8601, getSourceStops, getDeparturesForStopAndDateAjax, getSubsequentStops, getYearVerdictAjax, getGeoJSONAjax, dataFreshness };

process.on('unhandledRejection', function onError(err) {
  throw err;
});


function shapesForStoptimePair(stopT1, stopT2, stops, shapes: any[]) {
  if (useShapeDistance(stopT1, stopT2, shapes)) {
    return shapesForStoptimePairUsingDist(stopT1, stopT2, shapes);
  }
  return shapesForStoptimePairUsingLatLon(stopT1, stopT2, stops, shapes);
}

function useShapeDistance(stopT1, stopT2, shapes) {
  if (stopT1.shape_dist_traveled === undefined || !stopT1.shape_dist_traveled ||
    stopT2.shape_dist_traveled === undefined || !stopT2.shape_dist_traveled) {
    return false;
  }
  for (var i = 1; i < shapes.length; i++) {
    if (shapes[i].shape_dist_traveled === undefined) {
      return false;
    }
  }
  return true;
}

function shapesForStoptimePairUsingDist(st1, st2, shapes: any[]) {
  // can I assume shapes is sorted? I shall assume that. And regret it.
  var startShapeDistance = st1.shape_dist_traveled;
  var endShapeDistance = st2.shape_dist_traveled;
  var startShapeIndex;
  var endShapeIndex;
  for (var i = 1; i < shapes.length; i++) {
    if (startShapeIndex === undefined && shapes[i].shape_dist_traveled >= startShapeDistance) {
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

function latLonDistance(lat1, lon1, lat2, lon2) {
  var dy = Math.abs(lat1 - lat2)
  var dx = Math.abs(lon1 - lon2)
  return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2))
}

function shapeIndexNearestToStop(stop, shapes) {
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

function shapesForStoptimePairUsingLatLon(
  stopT1, stopT2, stops, shapes: any[]) {
  var stop1, stop2;
  for (var i = 0; i < stops.length; i++) {
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

function vehicleHeading(shape1, shape2) {
  // console.log("heading from " + shape1.loc + " to " + shape2.loc);
  var dy = shape2.shape_pt_lat - shape1.shape_pt_lat;
  var dx = shape2.shape_pt_lon - shape1.shape_pt_lon;
  return atan2ToSuncalc(Math.atan2(dy, dx));
}

function atan2ToSuncalc(radians) {
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

function segmentDistance(shape1, shape2) {
  return latLonDistance(shape1.shape_pt_lat, shape1.shape_pt_lon,
    shape2.shape_pt_lat, shape2.shape_pt_lon);
}

function segmentMidpoint(shape1, shape2) {
  return [(shape1.shape_pt_lat + shape2.shape_pt_lat) / 2.0,
  (shape1.shape_pt_lon + shape2.shape_pt_lon) / 2.0]
}

function transitTimeToRealDate(dateObj, timeStr, timeZone) {
  if (timeZone === undefined) throw new Error("You must specify a time zone.");
  var hourMinSec = timeStr.split(':'); // Also assuming this works!
  var dayOffset = Math.floor(hourMinSec[0] / 24);
  hourMinSec[0] = hourMinSec[0] % 24;
  var momentArray = [
    dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hourMinSec[0],
    hourMinSec[1], hourMinSec[2]];
  // console.log(momentArray);
  const first = moment.tz(momentArray, timeZone);
  const second = first.add(dayOffset, "days");
  return second.toDate();
}

function addWhyDoIHaveToWriteThis(x, y) {
  return x + y;
}

function durationsForShapeList(stopT1, stopT2, shapes, dateObj, timeZone) {
  var segmentDistances = new Array(shapes.length - 1);
  for (var i = 0; i < (shapes.length - 1); i++) {
    segmentDistances[i] = segmentDistance(shapes[i], shapes[i + 1]);
  }
  var totalDistance = segmentDistances.reduce(addWhyDoIHaveToWriteThis);
  var segmentFractions = segmentDistances.map(d => d / totalDistance);
  var dateA = transitTimeToRealDate(dateObj, stopT1.departure_time, timeZone);
  var dateB = transitTimeToRealDate(dateObj, stopT2.departure_time, timeZone);
  var duration = dateB.getTime() - dateA.getTime();
  var segmentDurations = segmentFractions.map(f => f * duration);
  return segmentDurations;
}

var sunStatus = {
  LEFT: 0,
  RIGHT: 1,
  CENTER: 2,
  DARK: 3
}

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

function sunStatusForSegment(startDate, endDate, startShape, endShape) {
  // console.log(startDate + " " + endDate);
  var sunLocation = segmentMidpoint(startShape, endShape);
  var sunTime = new Date((startDate.getTime() + endDate.getTime()) / 2);
  var heading = vehicleHeading(startShape, endShape);
  // console.log("heading " + heading);
  var sunData = suncalc.getPosition(sunTime, sunLocation[0], sunLocation[1]);
  // console.log(sunLocation + " " + sunTime);
  // console.log(sunData);
  if (sunData.altitude < 0) return sunStatus.DARK;
  return relativeToHeading(heading, sunData.azimuth);
}

// https://stackoverflow.com/questions/4467539/javascript-modulo-gives-a-negative-result-for-negative-numbers
function modJavascriptWhyWhyWhy(n, m) {
  return ((n % m) + m) % m;
}

function relativeToHeading(heading, azimuth) {
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


function sunTimesForStoptimePair(stoptime1, stoptime2, allStops, allShapes,
  dateObj, timeZone) {
  // console.log("In sunTimesForStoptimePair, allShapes is of type " + typeof(allShapes));
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
      shapes[i], shapes[i + 1]);
    // console.log(durations[i] + " ms with sunStatus " + segmentResult);

    statusTime[segmentResult] += Math.round(durations[i]); // nearest ms?
    startTime = endTime;
  }
  return statusTime;
}

function sunDetailsForStoptimePair(stoptime1, stoptime2, allStops, allShapes: any[],
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
      shapes[i], shapes[i + 1]);
    results[i] = {
      line: [
        [shapes[i].shape_pt_lon, shapes[i].shape_pt_lat],
        [shapes[i + 1].shape_pt_lon, shapes[i + 1].shape_pt_lat]],
      sunStatus: segmentResult
    };
  }
  return results;
  //return geojson.parse(results, {'LineString': 'line'});
}

function stoptimesAlongRoute(stopID1, stopID2, routeStoptimes, allStops) {
  var result = [];
  var onRoute = false;
  var parentStop = new Map();
  for (var i = 0; i < allStops.length; i++) {
    if (allStops[i].parent_station !== undefined) {
      parentStop.set(allStops[i].stop_id, allStops[i].parent_station);
    }
  }
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

function addArrays(a1, a2) {
  // This would be one line in a language with a "zipWith" function.
  console.assert(a1.length == a2.length, "Arrays must be of equal length.");
  var result = new Array(a1.length);
  for (var i = 0; i < result.length; i++) {
    result[i] = a1[i] + a2[i];
  }
  return result;
}

function sunStatusAlongRoute(stopID1, stopID2, routeStoptimes,
  allStops, allShapes, dateObj, timeZone) {
  var curStatus: number[] = new Array(
    Object.keys(sunStatus).length).fill(0);
  var stoptimes = stoptimesAlongRoute(stopID1, stopID2, routeStoptimes,
    allStops);
  if (stoptimes.length < 2) throw "found less than 2 stoptimes on route.";
  for (var i = 1; i < stoptimes.length; i++) {
    var nextStatus = sunTimesForStoptimePair(
      stoptimes[i - 1], stoptimes[i], allStops, allShapes, dateObj, timeZone);
    curStatus = addArrays(curStatus, nextStatus);
  }
  return curStatus;
}

function sunDetailsAlongRoute(stopID1, stopID2, routeStoptimes,
  allStops, allShapes: any[], dateObj, timeZone) {
  var result = new Array();
  var stoptimes = stoptimesAlongRoute(stopID1, stopID2, routeStoptimes,
    allStops);
  if (stoptimes.length < 2) throw "found less than 2 stoptimes on route.";
  for (var i = 1; i < stoptimes.length; i++) {
    var curDetails = sunDetailsForStoptimePair(
      stoptimes[i - 1], stoptimes[i], allStops, allShapes, dateObj, timeZone);
    result = result.concat(curDetails);
  }
  return geojson.parse(result, { 'LineString': 'line' });
  // return result;
}

// if I have a tripID
// I can get shapes
// I can get stoptimes
// from the stoptimes I can get stops

function getStoptimesThenStops(db, tripID) {
  const stoptimes = gtfs.getStoptimes({ trip_id: tripID }, [], [], { db: db })
  const stopIDs = stoptimes.map(o => o.stop_id);
  // I don't think this getStops call needs to worry about parent_stations.
  const stops = gtfs.getStops({ stop_id: stopIDs }, [], [], { db: db });
  return [stoptimes, stops];
}

function getAllTripData(db, tripID) {
  const shapes: Object[] = Array.from(gtfs.getShapes({ trip_id: tripID }, [], [], { db: db }));
  const [stoptimes, stops] = getStoptimesThenStops(db, tripID);
  const timeZone = getTimeZoneForAgency(db);
  const output = {
    shapes: shapes,
    stoptimes: stoptimes,
    stops: stops,
    timeZone: timeZone
  };
  var outputStats = (
    output.stoptimes.length + " stoptimes, " + output.stops.length +
    " stops, time zone " + output.timeZone + ", " + output.shapes.length);
  // I don't remember why I did this.
  // if (output.shapes.length > 0) {
  //   outputStats += ("x" + output.shapes[0].length);
  // }
  outputStats += " shapes";
  console.log(outputStats);
  return output;
}

function dateRange(startDate, days) {
  var result = new Array(days);
  var nextDate = startDate;
  for (var i = 0; i < days; i++) {
    result[i] = new Date(nextDate);
    nextDate.setDate(nextDate.getDate() + 1);
  }
  return result;
}

function getYearOfTrips(db, tripID, startDate, fromStop, toStop) {
  const tripData = getAllTripData(db, tripID);
  var dates = dateRange(startDate, 365); // Sucks if it's a leap year.
  var result = new Array(365);
  console.log("In getYearOfTrips, tripData.shapes is of type " + typeof(tripData.shapes) + " and tripData.shapes[0] is of type " + typeof(tripData.shapes[0]));
  for (var i = 0; i < dates.length; i++) {
    result[i] = {
      date: dates[i],
      sunStatus: sunStatusAlongRoute(
        fromStop, toStop, tripData.stoptimes, tripData.stops,
        tripData.shapes, dates[i], tripData.timeZone)
    };
  }
  return result;
}

function getDetailsForTrip(db, tripID, startDate, fromStop, toStop) {
  const tripData = getAllTripData(db, tripID);
  console.log("Working on time zone " + tripData.timeZone);
  const geojsonNamingCollision = sunDetailsAlongRoute(
    fromStop, toStop, tripData.stoptimes, tripData.stops,
    tripData.shapes, startDate, tripData.timeZone);
  return geojsonExtent.bboxify(geojsonNamingCollision);
}

function formatMultiDayResults(results) {
  var curVerdict = sunnySideVerdict(results[0].sunStatus);
  var segmentStarted = results[0].date.toDateString();
  var output = "";
  for (var i = 1; i < results.length; i++) {
    var newVerdict = sunnySideVerdict(results[i].sunStatus);
    if ((i == (results.length - 1)) || (newVerdict != curVerdict)) {
      var segmentEnded;
      if (i == (results.length - 1)) {
        segmentEnded = results[i].date.toDateString();
      }
      else {
        segmentEnded = results[i - 1].date.toDateString();
      }
      var curDates;
      if (i == (results.length - 1) && output == "") {
        curDates = "All year round";
      }
      else {
        curDates = "From " + segmentStarted + " through " + segmentEnded;
      }
      var newOutput = (curDates + ", " + curVerdict + "<BR>");
      output += newOutput;
      curVerdict = newVerdict;
      segmentStarted = results[i].date.toDateString();
    }
  }
  return output;
}

function getYearVerdictAjax(
  db, tripID, startDate8601, fromStop, toStop) {
  const startDate = new Date(startDate8601);
  return formatMultiDayResults(getYearOfTrips(db, tripID, startDate, fromStop, toStop));
}

function getGeoJSONAjax(
  db, tripID, startDate8601, fromStop, toStop) {
  const startDate = new Date(startDate8601);
  return getDetailsForTrip(db, tripID, startDate, fromStop, toStop);
}

function getServicesForDate(db, dateObj): string[] {
  // Seriously, this is what mozilla.org says we should do.
  const dateYYYYMMDD = (dateObj.getFullYear() * 10000 +
    (dateObj.getMonth() + 1) * 100 +
    dateObj.getDate()).toString();
  const dayOfWeekLC = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday',
    'friday', 'saturday'][dateObj.getDay()]
  console.log("dateYYYYMMDD: " + dateYYYYMMDD + ", dayOfWeekLC: " + dayOfWeekLC);
  const servicesNormal = db
    .prepare(
      // a column name can't be a parameter! I spent over an hour debugging this!
      'SELECT service_id from calendar WHERE start_date <= $date AND end_date >= $date AND ' + dayOfWeekLC + ' = 1'
    )
    .all({ date: dateYYYYMMDD });
  const calendarDates = gtfs.getCalendarDates({ date: dateYYYYMMDD }, [], [], { db: db });
  console.log("result: ", servicesNormal.length, " service IDs, and ",
    calendarDates.length, " calendar dates.");
  var services: Set<string> = new Set(servicesNormal.map((s) => s.service_id));
  for (var i = 0; i < calendarDates.length; i++) {
    const exceptionService = calendarDates[i].service_id;
    if (calendarDates[i].exception_type == 1) {
      // console.log("Calendar exception: adding service " + exceptionService);
      services.add(exceptionService);
    }
    else if (calendarDates[i].exception_type == 2) {
      // console.log("Calendar exception: deleting service " + exceptionService);
      services.delete(exceptionService);
    }
    else console.error("Invalid exception_type: " +
      calendarDates[i].exception_type);
  }
  return Array.from(services);
}

function hasServiceOnDate(db, dateObj) {
  return (getServicesForDate(db, dateObj).length) > 0;
}

function nearbyDatesWithService(db, horizon) {
  var startDate = new Date(Date.now());
  startDate.setDate(startDate.getDate() - 1); // start from yesterday
  const possibleDates = dateRange(startDate, horizon);
  const bools = possibleDates.map(d => hasServiceOnDate(db, d));
  var output = [];
  for (var i = 0; i < possibleDates.length; i++) {
    if (bools[i]) { output.push(possibleDates[i]); }
  }
  return output;
}

function getDates8601(db) {
  const dates = nearbyDatesWithService(db, 8);
  return dates.map(
    d => (d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()));
}

function getStoptimesForStopAndDate(db, stopID, dateObj) {
  const serviceIDs = getServicesForDate(db, dateObj);
  if (serviceIDs.length < 1) {
    console.error("No service for this date: " + dateObj + " Or it is SEPTA's fault.");
  }
  // We have to get all the children of stopID, if it has any. Then we return
  // stoptimes for both the parent and the children.
  const childStops = gtfs.getStops({
    parent_station: stopID
  }, [], [], { db: db });
  const possibleStopIDs = childStops.map(s => s.stop_id).concat([stopID]);
  console.log("Possible stop IDs: " + possibleStopIDs);
  const tripIDs: string[] = Array.from(gtfs.getTrips({ service_id: serviceIDs }, ["trip_id"], [], { db: db }).map(t => t.trip_id));
  return gtfs.getStoptimes({
    stop_id: possibleStopIDs,
    trip_id: tripIDs
  }, [], [], { db: db });
}

function combineStoptimeWithTrip(db, stoptime) {
  const trips = gtfs.getTrips({
    trip_id: stoptime.trip_id
  }, [], [], { db: db });
  const moreStoptimes = gtfs.getStoptimes({
    trip_id: stoptime.trip_id
  }, [], [], { db: db });
  console.assert(trips.length == 1,
    "I expected to get only one trip back. This is bad.");
  console.assert(moreStoptimes.length > 1, "Arg why no more stoptimes?");
  const trip = trips[0];
  const lastStoptime = moreStoptimes[moreStoptimes.length - 1];
  const terminatesHere = (lastStoptime.stop_id == stoptime.stop_id);
  // God have mercy on me.
  const routes = gtfs.getRoutes({
    route_id: trip.route_id
  }, [], [], { db: db });
  const stops = gtfs.getStops({
    stop_id: lastStoptime.stop_id
  }, [], [], { db: db });
  console.assert(routes.length == 1,
    "Expected only one route.");
  console.assert(stops.length == 1,
    "Expected only one stop.");
  return {
    trip_id: trip.trip_id,
    departure_time: stoptime.departure_time,
    trip_headsign: trip.trip_headsign,
    block_id: trip.block_id,
    route_short_name: routes[0].route_short_name,
    route_long_name: routes[0].route_long_name,
    last_stop_name: stops[0].stop_name,
    terminates_here: terminatesHere,
    direction_id: trip.direction_id
  };
}

function formatAjaxDeparture(departure) {
  var departure_desc = departure.departure_time;
  if (departure.route_short_name)
    departure_desc += (" " + departure.route_short_name);
  else if (departure.route_long_name)
    departure_desc += (" " + departure.route_long_name);
  if (departure.block_id) departure_desc += (" #" + departure.block_id);
  var tripDestination;
  if (departure.trip_headsign) tripDestination = departure.trip_headsign;
  else tripDestination = departure.last_stop_name;
  departure_desc += (" toward " + tripDestination);
  return {
    trip_id: departure.trip_id,
    departure_desc: departure_desc
  }
}

function prependZeroIfNecessary(departureStr) {
  if (departureStr[1] == ':') return ("0" + departureStr);
  else return departureStr;
}

function sortByDepartureDesc(departures) {
  for (var i = 0; i < departures.length; i++) {
    departures[i].departure_desc = prependZeroIfNecessary(
      departures[i].departure_desc);
  }
  return departures.sort(function (a, b) {
    if (a.departure_desc < b.departure_desc) return -1;
    if (a.departure_desc > b.departure_desc) return 1;
    return 0;
  });
}
function getDeparturesForStopAndDateAjax(db, stopID, date8601) {
  const dateObj = new Date(date8601);
  const departures = getDeparturesForStopAndDate(db, stopID, dateObj);
  return sortByDepartureDesc(departures.map(formatAjaxDeparture));
}

function getDeparturesForStopAndDate(db, stopID, dateObj) {
  const stoptimes = getStoptimesForStopAndDate(db, stopID, dateObj);
  return refineAndFilterStoptimes(db, stoptimes);
}

function refineAndFilterStoptimes(db, stoptimes) {
  const departures = stoptimes.map(st => combineStoptimeWithTrip(db, st));
  return departures.filter(d => !d['terminates_here']);
}

function stopIDAndName(stop) {
  return { stop_id: stop.stop_id, stop_name: stop.stop_name };
}

function sortByStopName(stops) {
  return stops.sort(function (a, b) {
    if (a.stop_name < b.stop_name) return -1;
    if (a.stop_name > b.stop_name) return 1;
    return 0;
  });
}

function getSourceStops(db) {
  // I should filter out parent stations but I don't know how to do that right now.
  const stops = gtfs.getStops({}, [], [], { db: db });
  return sortByStopName(stops.map(stopIDAndName));
}

function lookupStopName(db, stopID) {
  const stops = gtfs.getStops({ stop_id: stopID }, [], [], { db: db });
  console.assert(stops.length == 1, "I expected exactly one stop.");
  return stopIDAndName(stops[0]);
}

function getSubsequentStops(db, stopID, tripID) {
  const stoptimes = gtfs.getStoptimes({
    trip_id: tripID
  }, [], [], { db: db });
  // stopID is a parent. But these stoptimes point to children.
  const allStopIDsOnTrip = stoptimes.map(o => o.stop_id);
  const stops = gtfs.getStops(
    { stop_id: allStopIDsOnTrip }, [], [], { db: db });
  var stopsByStopID = {};
  for (var i = 0; i < stops.length; i++) {
    stopsByStopID[stops[i].stop_id] = stops[i];
  }
  const startIndex = stoptimes.findIndex(
    st => (st.stop_id == stopID ||
      stopsByStopID[st.stop_id].parent_station == stopID));
  const remainingStoptimes = stoptimes.slice(startIndex + 1);
  const output = remainingStoptimes.map(st => (
    {
      stop_id: st.stop_id,
      stop_name: stopsByStopID[st.stop_id].stop_name
    }));
  return output;
}
function agencyFreshness(db, agencyKey) {
  const dates = nearbyDatesWithService(db, 31);
  return makeLengthDict(agencyKey, dates);
}

function makeLengthDict(agencyKey, dates) {
  const output = { agencyKey: agencyKey, upcomingDates: dates.length };
  console.log(output);
  return output;
}

function dataFreshness(dbMap) {
  return dbMap.keys().map((agencyKey) => agencyFreshness(dbMap.get(agencyKey), agencyKey));
}

function getTimeZoneForAgency(db) {
  const agencies = gtfs.getAgencies({}, [], [], { db: db });
  if (agencies.length < 1) throw new Error(
    "No agencies found.");
  if (agencies[0].agency_timezone === undefined) {
    console.log(agencies[0].agency_name + " has no timezone set, defaulting to US/Eastern.");
    return "US/Eastern";
  }
  return agencies[0].agency_timezone;
}
