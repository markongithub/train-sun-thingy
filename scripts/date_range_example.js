const gtfs = require('gtfs');
const MyCode = require('../some_code');
const mongoose = require('mongoose');

const config = {
  mongoUrl: 'mongodb://localhost:27017/',
};

mongoose.Promise = global.Promise;
mongoose.connect(config.mongoUrl, {useMongoClient: true});

// For the next 365 days, get the verdict for trip CHE_734_V5_M 
MyCode.getAllTripDataP("septa-rail", "CHE_734_V5_M")
.then(res => {
  var dates = MyCode.dateRange(new Date(Date.now()), 365);
  for (var i=0; i< dates.length; i++) {
    console.log(dates[i]);
    console.log(MyCode.sunnySideVerdict(MyCode.sunStatusAlongRoute(
      90007, 90720, res.stoptimes, res.stops, res.shapes[0], dates[i])));
  }    
   mongoose.connection.close();
});
