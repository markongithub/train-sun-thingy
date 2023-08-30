import { importGtfs } from 'gtfs';

const config = {
  sqlitePath: process.argv[3],
  agencies: [
    {
      path: process.argv[2],
    },
  ],
  logFunction: function (text) {
    // Do something with the logs here, like save it or send it somewhere
    console.log(text);
  },
};


await importGtfs(config);