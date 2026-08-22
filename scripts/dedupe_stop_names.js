import { getStops, getStoptimes, getTrips, openDb } from 'gtfs';

function directionDescription(direction_id) {
  switch (direction_id) {
    case 0:
      return "from hub"
    case 1:
      return "to hub"
    default:
      console.log("I have no idea what to do with", direction_id);
      return "oh no we are fucked"
  }
}
function dedupeStop(db, stop_name) {
  const stops = getStops({
    stop_name: stop_name
  }, [], [], { db: db });
  console.log("There are " + stops.length + " stops named " + stop_name);
  // var headsignByStop = new Map();
  // stops.forEach(stop => headsignByStop.set(stop.stop_id, mostPopularHeadsignForStop(db, stop.stop_id)));
  const directionIDByStop = new Map(stops.map(stop => [stop.stop_id, mostPopularDirectionIDForStop(db, stop.stop_id)]));
  const directionIDSet = new Set(directionIDByStop.values());
  var newStopNames;
  if (directionIDSet.size == stops.length) {
    console.log("There is one most-common direction ID per stop.");
    newStopNames = new Map(Array.from(directionIDByStop.keys()).map(stop_id => [stop_id, stop_name + " (" + directionDescription(directionIDByStop.get(stop_id)) + ")"]));
  }
  else {
    if (directionIDSet.size == 1) {
      console.log("All these stops have the same most-common headsign:" + directionIDSet.entries().next()[0]);
    }
    else {
      console.log("There is a mess of direction IDs.");
    }
    newStopNames = new Map(stops.map(stop => [stop.stop_id, `${stop.stop_name} (${stop.stop_lat},${stop.stop_lon})`]));
  }
  for (const [key, value] of newStopNames) {
    console.log(`Stop ${key} will be renamed "${value}".`);
    const statement = db.prepare('UPDATE stops SET stop_name=$new_name WHERE stop_id=$stop_id');
    statement.run({ stop_id: key, new_name: value });
  }
}

function mostPopularHeadsignForStop(db, stop_id) {
  const stopTimes = getStoptimes({ stop_id: stop_id }, [], [], { db: db });
  const tripIDs = stopTimes.map(st => st.trip_id);
  const trips = getTrips({ trip_id: tripIDs }, [], [], { db: db });
  const row = db.prepare('SELECT trips.trip_headsign,COUNT(*) as count_by_headsign FROM stops,stop_times,trips WHERE stops.stop_id=stop_times.stop_id AND stop_times.trip_id = trips.trip_id AND stops.stop_id = ? GROUP BY trips.trip_headsign ORDER BY count_by_headsign DESC LIMIT 1').get(stop_id);
  // console.log("I think we want "+ row.trip_headsign);//Object.keys(row));
  return row.trip_headsign;
}

function mostPopularDirectionIDForStop(db, stop_id) {
  const stopTimes = getStoptimes({ stop_id: stop_id }, [], [], { db: db });
  const tripIDs = stopTimes.map(st => st.trip_id);
  const trips = getTrips({ trip_id: tripIDs }, [], [], { db: db });
  const row = db.prepare('SELECT trips.direction_id,COUNT(*) as count_by_direction FROM stops,stop_times,trips WHERE stops.stop_id=stop_times.stop_id AND stop_times.trip_id = trips.trip_id AND stops.stop_id = ? GROUP BY trips.direction_id ORDER BY count_by_direction DESC LIMIT 1').get(stop_id);
  // console.log("I think we want "+ row.trip_headsign);//Object.keys(row));
  return row.direction_id;
}

const db = openDb({ sqlitePath: process.argv[2] });

const duplicateStopNames = db.prepare(
  'SELECT stop_name FROM (SELECT stop_name,COUNT(*) as count_by_name FROM stops WHERE parent_station IS NULL GROUP BY stop_name) WHERE count_by_name > 1'
)
  .all();

console.log("I count " + duplicateStopNames.length + " stop names used by multiple stops.");

duplicateStopNames.forEach(record => dedupeStop(db, record.stop_name));
