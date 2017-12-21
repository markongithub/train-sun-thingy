
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
    for (var i=0; i < data.length; i++) {
      // console.log("Appending " + data[i].stop_name);
      var newOpt = new Option(data[i].stop_name, data[i].stop_id);
      sourceStops.append(newOpt);
    }
  });
}
$('#agencyKey').change(repopulateDatesAndSourceStopsFromAgency);

function repopulateTripsFromDateAndSourceStop() {
  const agencyKey = $("#agencyKey").val();
  const newDate = $("#date").val();
  const newSource = $("#sourceStop").val();
  const sourceStops = $("#sourceStop");
  const trips = $("#trip");
  clearEverythingAfterSourceStop();
  $("#mapDate")[0].value = newDate;
  console.log("I made the mapDate " + $("#mapDate")[0].value);
  $.getJSON("/trips",
            {agencyKey: agencyKey, date: newDate, sourceStop: newSource},
            function(data) {

    for (var i=0; i < data.length; i++) {
      var newOpt = new Option(data[i].departure_desc, data[i].trip_id);
      trips.append(newOpt);
    }
  });
}
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
  const tripDate = $("#date").val();
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
  $("#mapDate")[0].value = tripDate;
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
    console.log("Response from server: " + geojson);
    map.data.forEach(f => map.data.remove(f));
    mapSideEffect = map.data.addGeoJson(geojson);
    var sw = new google.maps.LatLng(geojson.bbox[1], geojson.bbox[0]);
    var ne = new google.maps.LatLng(geojson.bbox[3], geojson.bbox[2]);
    map.fitBounds(new google.maps.LatLngBounds(sw, ne));
    colorCode();
    $("#map_doc")[0].style.visibility = "visible"; 
    $("#mapDate")[0].style.visibility = "visible"; 
  });
}

var mapOptions = {
  zoom: 5,
  center: new google.maps.LatLng(40.502651, -74.449498) // yeah
};
var mapSideEffect;

var map = new google.maps.Map(
  document.getElementById('map_canvas'), mapOptions);

function colorCode() {
  map.data.setStyle(function(feature) {
    if (feature.getProperty("sunStatus") != undefined) {
      var sunStatus = feature.getProperty("sunStatus");
      var colors = ['aqua', 'red', 'white', 'black'];
      return {
        strokeColor: colors[sunStatus]
      };
    }
  });
}

var picker= new Pikaday({field: document.getElementById('mapDate'),
                         onSelect: function(date) {
                           populateMap(picker.toString()); }});
clearEverythingAfterAgency();
console.log("We definitely ran the client.js once.");
