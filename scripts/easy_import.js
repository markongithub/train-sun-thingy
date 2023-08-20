import { importGtfs } from 'gtfs';

const config = {
  sqlitePath: process.argv[4],
  agencies: [
    {
      path: process.argv[3],
    },
  ],
  logFunction: function (text) {
    // Do something with the logs here, like save it or send it somewhere
    console.log(text);
  },
};


await importGtfs(config);