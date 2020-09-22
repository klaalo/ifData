const config = require('../config.json');
const countData = require('../ifDataGet/countData.js');

const moment = require('moment');

const {
  Datastore
} = require('@google-cloud/datastore');
const datastore = new Datastore({
  projectId: config.gcp.projectId,
  keyFilename: config.gcp.keyFilename
});

const dateFormat = "YYYY-MM-DD HH:mm:ssZ";

exports.run = () => {
  getFirst()
    .then((entity) => {
      var tMoment = moment(entity.date);
      if (tMoment.isBefore(moment().subtract(config.general.summariserDayDays, 'days'))) {
        summariseDay(tMoment, entity);
      } else {
        if (config.general.debug) {
          console.log({
            debug: 'not enough days for summariser',
            tMoment: tMoment.toDate(),
            deltaDay: moment().subtract(config.general.summariserDayDays, 'days').toDate(),
            summariserDayDays: config.general.summariserDayDays
          });
        }
      }
    });
}

function summariseDay(tMoment, entity) {
  getDay(tMoment)
    .then((entities) => {
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
      summarised.ifDescr = entity.ifDescr;
      summarised.ifId = entity.ifId;

      saveDaySummary(summarised)
        .then((createdKeys) => {
          if (countedData.keys.length < 500) {
            deleteKeys(countedData.keys);
          } else {
            while (countedData.keys.length > 500) {
              var keys = countedData.keys.splice(0, 500);
              deleteKeys(keys);
            }
            deleteKeys(countedData.keys);
          }
        });
    });
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

function saveDaySummary(summarised) {
  var key = datastore.key([config.gcp.sumDayKind]);
  var entity = {
    key: key,
    data: summarised
  };
  return new Promise((resolve, reject) => {
    datastore.save(entity, (err, keys) => {
      if (err) {
        reject(err);
      } else {
        console.log({
          date: new(Date),
          status: [config.gcp.sumDayKind] + ' saved to datastore',
          key: key.path[1],
          summarised: summarised
        });
        resolve(keys);
      }
    });
  });
}

function getDay(getMoment) {
  return new Promise((resolve, reject) => {
    let query = datastore.createQuery(config.gcp.kind);
    query
      .filter('date', '>', getMoment.startOf('day').format(dateFormat))
      .filter('date', '<', getMoment.endOf('day').format(dateFormat))
      .order('date', {
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
    let query = datastore.createQuery(config.gcp.kind);
    query
      .order('date')
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
