const config = require('../config.json');

const moment = require('moment');

const {
  Datastore
} = require('@google-cloud/datastore');
const datastore = new Datastore({
  projectId: config.gcp.projectId,
  keyFilename: config.gcp.keyFilename
});

exports.run = () => {
  getFirst()
    .then((entity) => {
      var tMoment = moment(entity.fDate);
      if (tMoment.isBefore(moment().subtract(config.general.summariserDayDays, 'days'))) {
        reduceDay(tMoment, entity);
      } else {
        if (config.general.debug) {
          console.log({
            debug: 'not enough days for reducer',
            tMoment: tMoment.toDate(),
            deltaDay: moment().subtract(config.general.summariserDayDays, 'days').toDate(),
            summariserDayDays: config.general.summariserDayDays
          });
        }
      }
    });
}

function reduceDay(tMoment, entity) {
  getDay(tMoment)
    .then((entities) => {
      var sumTemp = 0;
      var sumHum = 0;
      var sumPress = 0;
      var count = 0;

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
      console.log(reduced);
      saveReduced(reduced)
        .then((createdKeys) => {
          deleteEntities(getKeys(entities));
        });
    });
}

function deleteEntities(keys) {
  if (keys.length < 500) {
    deleteKeys(keys);
  } else {
    while (keys.length > 500) {
      var myKeys = keys.splice(0, 500);
      deleteKeys(myKeys);
    }
    deleteKeys(keys);
  }

}

function deleteKeys(keys) {
  datastore.delete((keys), (err) => {
    if (err) {
      console.log({
        'datastore error': err
      });
    } else {
      console.log({
        'Deleted entities count': keys.length
      });
    }
  });

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
  return new Promise((resolve, reject) => {
    datastore.save(entity, (err, apiResponse) => {
      if (err) {
        console.log({
          'Datastore error': err
        });
        reject(err);
      }
      console.log({
        date: new(Date),
        status: 'saved to datastore',
        key: apiResponse.mutationResults[0].key.path[0].id,
        kind: apiResponse.mutationResults[0].key.path[0].kind
      });
      resolve(apiResponse.mutationResults[0].key.path[0].kind);
    });
  });
}

function getDay(getMoment) {
  return new Promise((resolve, reject) => {
    let query = datastore.createQuery(config.temp.kind);
    query
      .filter('fDate', '>', getMoment.startOf('day').format())
      .filter('fDate', '<', getMoment.endOf('day').format())
      .order('fDate', {
        descending: true
      })
      .run((err, entities) => {
        if (err) {
          reject(err);
        } else {
          resolve(entities);
        }
      });
  });
}

function getFirst() {
  return new Promise((resolve, reject) => {
    let query = datastore.createQuery(config.temp.kind);
    query
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
