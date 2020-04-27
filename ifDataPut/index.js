const config = require('../config.json');
const counterdata = require("./counterData.js");
const moment = require('moment');

const io = require('socket.io-client');
const socket = io.connect(config.temp.socketHost);

const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore({
  projectId: config.gcp.projectId,
  keyFilename: config.gcp.keyFilename
});

const summariser = require('./summariser.js');
const reducer = require('./reducer.js');

var sigterm = false;
var lastRun = new Date(0);

var lastRuuviUpdate;

get();
setInterval(get, config.general.intervalMin * 60000);
summariser.run();
setInterval(summariser.run, config.general.summariserHours * 3600 * 1000);
reducer.run();
setInterval(reducer.run, config.general.summariserHours * 3600 * 1000);

function get() {
  if (sigterm) { return; };
  counterdata.get(config.snmp.ifIdx,
      config.snmp.host,
      config.snmp.community)
    .then((data) => {
      console.log(data);
      if (config.general.storeGcp) {
        save(data);
      }
    }
  );
}

function dataSaveHandler(err, apiResponse) {
      if (err) {
          return console.log({ 'Datastore error' : err});
      }
      console.log({
        date: new(Date),
        status: 'saved to datastore',
        key: apiResponse.mutationResults[0].key.path[0].id,
	kind: apiResponse.mutationResults[0].key.path[0].kind
      });
}

function save(data) {
  data.fDate = moment(data.date).format();
  var key = datastore.key([config.gcp.kind]);
  var entity = {
    key: key,
    data: data
  }
  datastore.save(entity, dataSaveHandler);
}

function exitMe(code) {
    console.log({ 'exit code':  code });
    sigterm = true;
    process.exit();
}

process.on('SIGINT', () => {
    exitMe('SIGINT');
});

process.on('SIGTERM', () => {
    exitMe('SIGTERM');
});


function saveTagdata(data) {
    var key = datastore.key([config.temp.kind]);
    data.fDate=moment().format();
    var entity = {
	key: key,
	data: data
    }
    console.log(data);
    datastore.save(entity, dataSaveHandler);

    lastRuuviUpdate = moment();
}

socket.on('connect_error', (error) => {
  exitMe({ 'socket connect_error': error});
})

socket.on('disconnect', (reason) => {
  exitMe('socket ' + reason);
});

socket.on('updated', (data) => {
  if (lastRuuviUpdate &&
            lastRuuviUpdate instanceof moment &&
            lastRuuviUpdate.isBefore(
		moment().subtract(config.temp.sampleIntervalMin, 'minutes'))) {

	    saveTagdata(data);

	} else if (!lastRuuviUpdate) {
	    saveTagdata(data);
	}
});
