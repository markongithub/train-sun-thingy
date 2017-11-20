const gtfs = require('gtfs');
const MyCode = require('../some_code');
const mongoose = require('mongoose');

const config = {
  mongoUrl: 'mongodb://localhost:27017/',
};

mongoose.Promise = global.Promise;
mongoose.connect(config.mongoUrl, {useMongoClient: true});
const today = new Date(Date.now());

MyCode.getYearOfTripsP(process.argv[2], process.argv[3], today, process.argv[4], process.argv[5])
.then(results => {
  console.log(MyCode.formatMultiDayResults(results));
  mongoose.connection.close();
})
.catch(err => console.log(err.stack));
