/*

  Node.js 10 function to serve iot metrics for
  visualisation on a web page.

  Function gets the metrics from Google Datastore
  and provides json feed for the chart.

  Author: karilaalo.fi

*/

const config = require('./config.json');
const countData = require('./countData.js');

const {Datastore} = require('@google-cloud/datastore');

/*  Use GCP Node.js 10 environment variable to
    check if function is run locally or
    in the cloud. Datastore initialisation requires
    keyfile if run outside GCP environment.
*/
const datastore = process.env.K_SERVICE ?
  new Datastore()
  :
  new Datastore({
    projectId: config.gcp.projectId,
    keyFilename: config.gcp.keyFilename
  });

const moment = require('moment-timezone');
const Base64 = require('js-base64').Base64;

exports.ifDataGet = (req, res) => {

  /*  Disable authentication if run locally.
      Also, send cors headers if run locally. In
      cloud environment ESP is used to provide cors
      headers.
  */
  if (process.env.K_SERVICE) {
    if (!isAllowed(req)) {
      res.status(401).send('Unathorised.');
      return;
    }
  } else {
    res.set('Access-Control-Allow-Origin', 'http://localhost:8080');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Authorization');
  }

  if (req.query.amiallowed) {
    if (!process.env.K_SERVICE ||
      (req.method == 'GET' &&
          isAllowed(req))) {
        res.send('true');
        return;
    }  else {
        res.status(401).send('Unauthorised user.');
        return;
    }
  } else if (!(req.query.gran
    || req.query.dataType)) {
      res.status(400).send('Bad request');
      return;
  }

  switch (req.method) {
    case 'OPTIONS':
      res.send();
      return;
      break;
    case 'GET':

      if (req.query.dataType &&
        req.query.dataType == "tagSingle") {
          getTagdata(1)
            .then((data) => {
              res.send(data[0]);
            })
            .catch((responseStr) => {
              res.status(500).send(responseStr);
            });
      } else if (req.query.dataType &&
        req.query.dataType == "tagMultiple") {
          getTagdata(config.temp.getLimit, req.query.gran)
            .then((data) => {
              if (req.query.out &&
                req.query.out == 'chart') {
                  if (req.query.gran == 'daily') {
                    res.send(formReducedTagResponse(data));
                  } else {
                    res.send(formTagResponse(data));
                  }
                } else {
                    res.send(data);
                }
            })
            .catch((responseStr) => {
              res.status(500).send(responseStr);
            });
      } else {
        get(req.query.gran)
          .then((data) => {
            if (req.query.out &&
              req.query.out == 'chart') {
                res.send(formResponse(data));
              } else {
                res.send(data);
              }
          })
          .catch((responseStr) => {
            res.send(responseStr);
          });
      }
      break;
    default:
      res.status(400).send('Method not supported');
  }

};


function getTagdata(limit, gran) {

  var myGran = "";
  switch (gran) {
    case 'daily':
      myGran = config.temp.reducedDayKind;
      break;
    default:
      myGran = config.temp.kind;
      break;
  }

  return new Promise((resolve, reject) => {

    var myLimit;
    if (limit != 1) {
      myLimit = (myGran == config.temp.kind) ?
        config.temp.getLimit :
        config.general.getDaysLimit;
    }

    let query = datastore.createQuery(myGran);
    query
      .order('fDate', {
        descending: true
      })
      .limit(myLimit)
      .run((err, entities) => {
        if (err) {
          console.log({ error: 'datastore error'});
          reject('datastore error');
        }
        resolve(entities);
      });
  });
};

function get(gran) {

  var myGran = "";
  switch (gran) {
    case 'daily':
      myGran = config.gcp.sumDayKind;
      break;
    default:
      myGran = config.gcp.kind;
      break;
  }

  return new Promise((resolve, reject) => {
    const limit = (myGran == config.gcp.kind) ?
      config.general.getLimit :
      config.general.getDaysLimit;
    let query = datastore.createQuery(myGran);
    query
      .order('date', {
        descending: true
      })
      .limit(limit)
      .run((err, entities) => {
        if (err) {
          console.log(err);
          reject('datastore error');
        }
        if (myGran == config.gcp.kind) {
          resolve(countData.countData(entities).data);
        } else {
          resolve(countData.divided(entities).data);
        }
      });
  });
}

function formResponse(data) {
  var inData = new Array();
  var outData = new Array();
  var labels = new Array();
  data.forEach((element) => {
    var date = moment(element.date)
      .tz(config.general.timeZone).format('LLL');
    inData.push({
      x: date,
      y: element.in
    });
    outData.push({
      x: date,
      y: element.out
    });
    labels.push(date);
  });
  return { labels: labels, inData: inData, outData: outData };
}

function formTagResponse(data) {
  var tempData = new Array();
  var humidityData = new Array();
  var pressureData = new Array();
  var batteryData = new Array();
  var labels = new Array();
  data.forEach((element) => {
    var date = moment(element.fDate)
      .tz(config.general.timeZone).format('LLL');
    tempData.push({
      x: date,
      y: element.temperature
    });
    humidityData.push({
      x: date,
      y: element.humidity
    });
    pressureData.push({
      x: date,
      y: element.pressure / 100
    });
    batteryData.push({
      x: date,
      y: element.battery
    });
    labels.push(date);
  });
  return {
    labels: labels,
    tempData: tempData,
    humidityData: humidityData,
    pressureData: pressureData,
    batteryData: batteryData
  };
}

function formReducedTagResponse(data) {
  var tempData = new Array();
  var humidityData = new Array();
  var pressureData = new Array();
  var batteryData = new Array();
  var labels = new Array();
  data.forEach((element) => {
    var date = moment(element.fDate)
      .tz(config.general.timeZone).format('LLL');
    tempData.push({
      x: date,
      y: element.temperatureAvg
    });
    humidityData.push({
      x: date,
      y: element.humidityAvg
    });
    pressureData.push({
      x: date,
      y: element.pressureAvg / 100
    });
    labels.push(date);
  });
  return {
    labels: labels,
    tempData: tempData,
    humidityData: humidityData,
    pressureData: pressureData,
    batteryData: batteryData
  };

}

function isAllowed(req) {
  if (req.query.dataType && req.query.dataType == 'tagSingle') return true;
  if (!req.get('X-Endpoint-API-UserInfo')) return false;
  var jwt = JSON.parse(Base64.decode(req.get('X-Endpoint-API-UserInfo')));
  return jwt.sub == process.env.A_USER ? true : false;
}
