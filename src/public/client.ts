

enum sunStatus {
  LEFT,
  RIGHT,
  CENTER,
  DARK,
}

function emptySelect(element) {
  element.empty();
  element.append(new Option());
}

function clearEverythingAfterAgency() {
  emptySelect($("#date"));
  emptySelect($("#sourceStop"));
  clearEverythingAfterSourceStop();
}

function clearEverythingAfterSourceStop() {
  emptySelect($("#trip"));
  clearEverythingAfterTrip();
}

function clearEverythingAfterTrip() {
  emptySelect($("#destinationStop"));
  clearEverythingAfterDestinationStop();
}

function clearEverythingAfterDestinationStop() {
  $("#verdict").html("");
  map.data.forEach(f => map.data.remove(f));
  $("#map_doc")[0].style.visibility = "hidden";
  $("#mapDate")[0].style.visibility = "hidden";
}

function repopulateDatesAndSourceStopsFromAgency() {
  const newKey = $(this).val();
  console.log("the agency key is now " + newKey);
  if (!newKey) {
    console.log("... so I am not going to do anything.");
    return;
  }
  const dates = $("#date");
  const sourceStops = $("#sourceStop");
  clearEverythingAfterAgency();
  $.getJSON("/dates", {agencyKey: newKey}, function(data) {
    for (var i=0; i < data.length; i++) {
      // console.log("Appending " + data[i].stop_name);
      var newOpt = new Option(data[i]);
      if (i==1) newOpt.selected = true;
      dates.append(newOpt);
    }
  });
  $.getJSON("/stops", {agencyKey: newKey}, function(data) {
    console.log("Starting to deal with " + data.length + " stops.");
    for (var i=0; i < data.length; i++) {
      // console.log("Appending " + data[i].stop_name);
      var newOpt = new Option(data[i].stop_name, data[i].stop_id);
      sourceStops.append(newOpt);
    }
  });
  console.log("I think I have finished repopulateDatesAndSourceStopsFromAgency");
}
$('#agencyKey').on("change", repopulateDatesAndSourceStopsFromAgency);

function repopulateTripsFromDateAndSourceStop() {
  const agencyKey = $("#agencyKey").val();
  const newDate = $("#date").val().toString();
  const newSource = $("#sourceStop").val();
  const sourceStops = $("#sourceStop");
  const trips = $("#trip");
  clearEverythingAfterSourceStop();
  if (!newDate || !newSource) return;
  (<HTMLInputElement>$("#mapDate")[0]).value = newDate;
  $.getJSON("/trips",
            {agencyKey: agencyKey, date: newDate, sourceStop: newSource},
            function(data) {

    for (var i=0; i < data.length; i++) {
      var newOpt = new Option(data[i].departure_desc, data[i].trip_id);
      trips.append(newOpt);
    }
  });
}
$('#date').change(repopulateTripsFromDateAndSourceStop);
$('#sourceStop').change(repopulateTripsFromDateAndSourceStop);

function repopulateDestinationsFromTrip() {
  const agencyKey = $("#agencyKey").val();
  const sourceStop = $("#sourceStop").val();
  const destStops = $("#destinationStop");
  const trip = $("#trip").val();
  clearEverythingAfterTrip();
  $.getJSON("/destinations",
            {agencyKey: agencyKey, trip: trip, sourceStop: sourceStop},
            function(data) {

    for (var i=0; i < data.length; i++) {
      var newOpt = new Option(data[i].stop_name, data[i].stop_id);
      destStops.append(newOpt);
    }
  });
}
$('#trip').change(repopulateDestinationsFromTrip);

function populateVerdict() {
  const agencyKey = $("#agencyKey").val();
  const tripDate = $("#date").val().toString();
  const sourceStop = $("#sourceStop").val();
  const destStop = $("#destinationStop").val();
  const trip = $("#trip").val();
  $("#verdict").html("Let me think about that for a minute...");
  console.log("Sending /verdict query...");
  $.get("/verdict",
            {agencyKey: agencyKey, trip: trip, sourceStop: sourceStop,
             destStop: destStop, date: tripDate},
            function(verdict) {
    console.log("Response from server: " + verdict);
    $("#verdict").html(verdict);
  });
  (<HTMLInputElement>$("#mapDate")[0]).value = tripDate;
  populateMap(tripDate);
}

$('#destinationStop').change(populateVerdict);

function populateMap(mapDate) {
  console.log("Populating the map with " + mapDate);
  const agencyKey = $("#agencyKey").val();
  const sourceStop = $("#sourceStop").val();
  const destStop = $("#destinationStop").val();
  const trip = $("#trip").val();
  $.getJSON("/geojson",
            {agencyKey: agencyKey, trip: trip, sourceStop: sourceStop,
             destStop: destStop, date: mapDate},
            function(geojson) {
    console.log("Response from server: " + JSON.stringify(geojson));
    console.log("Finished /geojson request. Attempting remove step...");
    map.data.forEach(f => map.data.remove(f));
    console.log("Got past remove step.");
    mapSideEffect = map.data.addGeoJson(geojson);
    console.log("Got past addGeoJson step.");
    var sw = { lat: geojson.bbox[1], lng: geojson.bbox[0] };
    var ne = { lat: geojson.bbox[3], lng: geojson.bbox[2] };
    map.fitBounds(new google.maps.LatLngBounds(sw, ne));
    console.log("Got past fitBounds before crashing.");
    colorCode();
    $("#map_doc")[0].style.visibility = "visible"; 
    $("#mapDate")[0].style.visibility = "visible"; 
  });
}

var mapOptions = {
  zoom: 5,
  center: {lat: 40.502651, lng: -74.449498},
};
var mapSideEffect;

var map = new google.maps.Map(document.getElementById("map_canvas") as HTMLElement, mapOptions);
function colorCode() {
  map.data.setStyle(function(feature) {
    console.log("Trying to setStyle on the feature", feature);
    let dumbStatus: unknown = feature.getProperty("sunStatus");
    if (dumbStatus != undefined && typeof dumbStatus == "number") {
      var thisSunStatus: number = dumbStatus;
      var colors = ['aqua', 'red', 'white', 'black'];
      return {
        strokeColor: colors[thisSunStatus]
      };
    }
  });
}

var datePicker= document.getElementById('mapDate');
if (datePicker) {
    datePicker.addEventListener('change', (event) => {
        // Force TypeScript to recognize the target as an input element
        const element = event.currentTarget as HTMLInputElement;
        if (element) {
            const rawDateString = element.value;
            console.log(rawDateString);
            populateMap(rawDateString);
        }
    });
}
clearEverythingAfterAgency();
console.log("agency is now", $("#agencyKey").val());
if ($("#agencyKey").val() != "") {
  repopulateDatesAndSourceStopsFromAgency();
}

console.log("We definitely ran the client.js once and we're using recent client-side code.");
