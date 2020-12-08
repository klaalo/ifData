const config = require('./config.json');
const countData = require('./countData.js');

const moment = require('moment-timezone');
const dateFormat = "YYYY-MM-DDTH:mm:ssz";


/*  Use GCP Node.js 12 environment variable to
    check if function is run locally or
    in the cloud. Datastore initialisation requires
    keyfile if run outside GCP environment.
*/
const {
  Datastore
} = require('@google-cloud/datastore');
const datastore = process.env.K_SERVICE ?
  new Datastore()
  :
  new Datastore({
    projectId: config.gcp.projectId,
    keyFilename: config.gcp.keyFilename
  });

exports.run = () => {

  var summarisedKeys;
  var summarised;
  return getFirst()
    .then((data) => {
      var entity = data[0][0];
      var tMoment = moment(entity.fDate);
      if (tMoment.isBefore(moment().subtract(config.general.summariserDayDays, 'days'))) {
        return Promise.resolve(entity);
      } else {
        return Promise.reject({
            debug: 'not enough days for summariser',
            status: 'ok',
            reason: 'nothing to do',
            tMoment: tMoment.toDate(),
            deltaDay: moment().subtract(config.general.summariserDayDays, 'days').toDate(),
            summariserDayDays: config.general.summariserDayDays
          });
      }
    })
    .then((entity) => {
      return getDay(moment(entity.fDate));
    })
    .then((data) => {
      if (data[0].length < 1) {
        return Promise.reject({
          status: "error",
          reason: "getDay returned no data"
        });
      }
      var sumData = summariseDay(data[0]);
      summarisedKeys = sumData.keys;
      summarised = sumData.data;
      return saveDaySummary(sumData.data);
    })
    .then((apiResponse) => {
      console.log({
        date: new(Date),
        status: 'ok',
        reason: [config.gcp.sumDayKind] + ' saved to datastore',
        key: apiResponse[0].mutationResults[0].key.path[0].id,
        summarised: summarised
      });

      var delPromises = new Array();
      while (summarisedKeys.length > 500) {
        var keys = countedData.keys.splice(0, 500);
        delPromises.push(
          datastore.delete(keys)
            .then(() => {
              console.log("Deleted entities count: " + keys.length);
              return keys.length;
            })
        );
      }
      delPromises.push(
        datastore.delete(summarisedKeys)
          .then(() => {
            console.log("Deleted entities count: " + summarisedKeys.length);
            return summarisedKeys.length;
          })
      );
      return Promise.all(delPromises);
    })
    .then((values) => {
      var deleted = 0;
      values.forEach((value) => {
        deleted += value;
      });
      return {
        status: "ok",
        reason: "reduced and deleted count of entities: " + deleted
      };
    });
}

function summariseDay(entities) {
    if (config.general.debug) {
      console.log("summariseDay entities: " + entities.length);
    }
    var tMoment = moment(entities[0].fDate);
    var countedData = countData.countData(entities);
    var summarised = {
      in: 0,
      out: 0,
      secs: 0
    };
    countedData.data.forEach((element) => {
      summarised.in += element.inOctets;
      summarised.out += element.outOctets;
      summarised.secs += element.secs;
    });
    summarised.date = tMoment.format();
    summarised.ifDescr = entities[0].ifDescr;
    summarised.ifId = entities[0].ifId;
    return { data: summarised, keys: countedData.keys};
}

function saveDaySummary(summarised) {
  var key = datastore.key([config.gcp.sumDayKind]);
  var entity = {
    key: key,
    data: summarised
  };
  return datastore.save(entity);
}

function getDay(getMoment) {
  let query = datastore.createQuery(config.gcp.kind);
  if (config.general.debug) {
    console.log("getting day: " +
      getMoment.tz(config.general.timeZone).startOf('day').toISOString(true));
  }
  return query
    .order('fDate', {
      descending: true
    })
    .filter('fDate', '>', getMoment.tz(config.general.timeZone).startOf('day').toISOString(true))
    .filter('fDate', '<', getMoment.tz(config.general.timeZone).endOf('day').toISOString(true))
    .run();
}

function getFirst() {
  let query = datastore.createQuery(config.gcp.kind);
  return query
    .order('fDate', {
      descending: false
      })
    .limit(1)
    .run();
}
