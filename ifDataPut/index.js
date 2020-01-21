const config = require('../config.json');
const counterdata = require("./counterData.js");
const moment = require('moment');

const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore({
  projectId: config.gcp.projectId,
  keyFilename: config.gcp.keyFilename
});

const summariser = require('./summariser.js');

var sigterm = false;
var lastRun = new Date(0);

get();
setInterval(get, config.general.intervalMin * 60000);
summariser.run();
setInterval(summariser.run, config.general.summariserHours * 3600 * 1000);


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


function save(data) {
  data.fDate = moment(data.date).format();
  var key = datastore.key([config.gcp.kind]);
  var entity = {
    key: key,
    data: data
  }
  datastore.save(entity, (err, keys) => {
      if (err) {
        return console.log('Datastore error | ' + err);
      }
      console.log({
        date: new(Date),
        status: 'saved to datastore',
        key: key.path[1]});
  });
}

process.on('exit', (code) => {
  console.log('exit code:' + code);
  sigterm = true;
});
