
function emptySelect(element) {
  element.empty();
  element.append(new Option());
}

function repopulateSourceStopsFromAgency() {
  const newKey = $(this).val();
  console.log("the agency key is now " + newKey);
  const sourceStops = $("#sourceStop");
  emptySelect(sourceStops);
  $.getJSON("/stops", {agencyKey: newKey}, function(data) {
    for (var i=0; i < data.length; i++) {
      // console.log("Appending " + data[i].stop_name);
      var newOpt = new Option(data[i].stop_name, data[i].stop_id);
      sourceStops.append(newOpt);
    }
  });
  
}
$('#agencyKey').change(repopulateSourceStopsFromAgency);

console.log("We definitely ran the client.js once.");
