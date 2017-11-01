var exports = module.exports = {};

exports.shapesForStopTimePair = function (st1, st2, shapes) {
  
  return shapesForStopTimePairUsingDist(st1, st2, shapes);
}

function shapesForStopTimePairUsingDist(st1, st2, shapes) {
  // can I assume shapes is sorted? I shall assume that. And regret it.
  startShapeDistance = st1.shape_dist_traveled;
  endShapeDistance = st2.shape_dist_traveled;
  var startShapeIndex;
  var endShapeIndex;
  for (var i = 1; i < shapes.length; i++){
    // console.log('Let us consider the shape when distance travelled is ' + shapes[i].shape_dist_traveled);
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
