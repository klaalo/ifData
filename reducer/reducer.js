const config = require('./config.json');

const moment = require('moment-timezone');


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

  let query = datastore.createQuery(config.temp.kind);
  return query
    .select('tagId')
    .groupBy('tagId')
    .run()
      .then((data) => {
        if (data[0].length > 0) {
          let reducePromises = new Array();
          data[0]
            .forEach((entity) => {
              reducePromises.push(reduceFlow(entity.tagId));
            });
          return Promise.all(reducePromises)
            .then((promArray) => {
              console.log({
                status: "ok",
                reason: "run " +
                  promArray.length + " tag reducers"
              });
            });
        } else {
            return Promise.reject({
              status: 'error',
              reason: 'no entities with tagId in Datastore'
            });
        }
      })

}

function reduceFlow(tagId) {
  var reducedKeys;
  var reduced;

  console.log({
    status: "ok",
    reason: "reducing tag",
    tagId: tagId
  });
  return getFirst(tagId)
    .then((entity) => {
      var tMoment = moment(entity.fDate);
      if (tMoment.isBefore(moment().subtract(config.general.summariserDayDays, 'days'))) {
        return Promise.resolve(entity);
      } else {
        return Promise.reject({
            debug: 'not enough days for reducer',
            status: 'ok',
            reason: 'nothing to do',
            tMoment: tMoment.toDate(),
            deltaDay: moment().subtract(config.general.summariserDayDays, 'days').toDate(),
            summariserDayDays: config.general.summariserDayDays
          });
      }
    })
  .then((entity) => {
    return getDay(entity.tagId, moment(entity.fDate));
    })
  .then((entities) => {
    if (entities[0].length < 1) {
      return Promise.reject({
        status: "error",
        reason: "getDay returned no data"
      });
    }
    reduced = reduceDay(entities[0]);
    reducedKeys = getKeys(entities[0]);
    return saveReduced(reduced);
    })
  .then((apiResponse) => {
    console.log({
      date: new(Date),
      status: 'ok',
      reason: [config.temp.reducedDayKind] + ' saved to datastore',
      key: apiResponse[0].mutationResults[0].key.path[0].id,
      kind: apiResponse[0].mutationResults[0].key.path[0].kind,
      reduced: reduced
    });

    var delPromises = new Array();
    while (reducedKeys.length > 500) {
      var keys = reducedKeys.splice(0, 500);
      delPromises.push(
        datastore.delete(keys)
          .then(() => {
            console.log({
              status: "ok",
              reason: "Deleted entities count: " + keys.length,
              tagid: tagId
            });
            return keys.length;
          })
      );
    }
    delPromises.push(
      datastore.delete(reducedKeys)
        .then(() => {
          console.log({
            status: "ok",
            reason: "Deleted entities count: " + reducedKeys.length,
            tagid: tagId
          });
          return reducedKeys.length;
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

function reduceDay(entities) {
    var sumTemp = 0;
    var sumHum = 0;
    var sumPress = 0;
    var count = 0;

    var entity = entities[0];
    var tMoment = moment(entity.fDate);
    entities.forEach((element) => {
      sumTemp += element.temperature;
      sumHum += element.humidity;
      sumPress += element.pressure;
      count += 1;
    });
    var reduced = {
      n: count,
      temperatureAvg: sumTemp / count,
      humidityAvg: sumHum / count,
      pressureAvg: sumPress / count,
      fDate: tMoment.endOf('day').format(),
      tagId: entity.tagId
    };
    return reduced;
}

function getKeys(entities) {
  var keys = new Array();
  entities.forEach((entity) => {
    keys.push(entity[Object.getOwnPropertySymbols(entity)[0]]);
  });
  return keys;
}

function saveReduced(reduced) {
  var key = datastore.key([config.temp.reducedDayKind]);
  var entity = {
    key: key,
    data: reduced
  };
  return datastore.save(entity);
}

function getDay(tagId, getMoment) {
    let query = datastore.createQuery(config.temp.kind);
    if (config.general.debug) {
      console.log({
          status: "ok",
          level: "debug",
          reason: "getting day",
          date: getMoment.tz(config.general.timeZone).startOf('day').toISOString(true),
          tagId: tagId
      });
    }
    return query
      .filter('tagId', '=', tagId)
      .filter('fDate', '>', getMoment.tz(config.general.timeZone).startOf('day').toISOString(true))
      .filter('fDate', '<', getMoment.tz(config.general.timeZone).endOf('day').toISOString(true))
      .run();
}

function getFirst(tagId) {
  return new Promise((resolve, reject) => {
    let query = datastore.createQuery(config.temp.kind);
    query
      .filter('tagId', '=', tagId)
      .order('fDate')
      .limit(1)
      .run((err, entities) => {
        if (err) {
          reject(err);
        } else {
          resolve(entities[0]);
        }
      });
  });
}
