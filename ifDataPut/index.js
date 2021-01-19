const config = require('../config.json');
const counterdata = require("./counterData.js");
const moment = require('moment');

const io = require('socket.io-client');
const socket = io.connect(config.temp.socketHost);

const {
  Datastore
} = require('@google-cloud/datastore');
const datastore = new Datastore({
  projectId: config.gcp.projectId,
  keyFilename: config.gcp.keyFilename
});

var sigterm = false;
var lastRun = new Date(0);

var lastRuuviUpdate = new Map();

get();
setInterval(get, config.general.intervalMin * 60000);

function get() {
  if (sigterm) {
    return;
  };
  counterdata.get(config.snmp.ifIdx,
      config.snmp.host,
      config.snmp.community)
    .then((data) => {
      console.log(data);
      if (config.general.storeGcp) {
        save(data);
      }
    });
}

function dataSaveHandler(err, apiResponse) {
  if (err) {
    return console.log({
      'Datastore error': err
    });
  }
  console.log({
    date: new(Date),
    info: 'saved to datastore',
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
  console.log({
    'exit code': code
  });
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
  data.fDate = moment().format();
  var entity = {
    key: key,
    data: data
  }
  console.log(data);
  datastore.save(entity, dataSaveHandler);

    lastRuuviUpdate.set(data.tagId, moment());
}

socket.on('connect_error', (error) => {
  exitMe({
    'socket connect_error': error
  });
})

socket.on('disconnect', (reason) => {
  exitMe('socket ' + reason);
});

socket.on('updated', (data) => {
    if (lastRuuviUpdate.has(data.tagId) &&
	lastRuuviUpdate.get(data.tagId) instanceof moment &&
	lastRuuviUpdate.get(data.tagId).isBefore(
	    moment().subtract(config.temp.sampleIntervalMin, 'minutes'))) {

    saveTagdata(data);

    } else if (!lastRuuviUpdate.has(data.tagId)) {
	saveTagdata(data);
    }
});
