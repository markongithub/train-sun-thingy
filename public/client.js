
function emptySelect(element) {
  element.empty();
  element.append(new Option());
}

function repopulateSourceStopsFromAgency() {
  const newKey = $(this).val();
  console.log("the agency key is now " + newKey);
  const sourceStops = $("#sourceStop");
  [sourceStops, $("#trip"), $("#destinationStop")].forEach(emptySelect);
  $.getJSON("/stops", {agencyKey: newKey}, function(data) {
    for (var i=0; i < data.length; i++) {
      // console.log("Appending " + data[i].stop_name);
      var newOpt = new Option(data[i].stop_name, data[i].stop_id);
      sourceStops.append(newOpt);
    }
  });
}
$('#agencyKey').change(repopulateSourceStopsFromAgency);

function repopulateTripsFromDateAndSourceStop() {
  const agencyKey = $("#agencyKey").val();
  const newDate = $("#date").val();
  const newSource = $("#sourceStop").val();
  const sourceStops = $("#sourceStop");
  const trips = $("#trip");
  [trips, $("#destinationStop")].forEach(emptySelect);
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

console.log("We definitely ran the client.js once.");
