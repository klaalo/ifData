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

/*  Use GCP environment variable to
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

function checkLocal(res) {
  /*  Send cors headers if run locally. In
      cloud environment ESP is used to provide cors
      headers.
  */
  if (!process.env.K_SERVICE) {
    res.set('Access-Control-Allow-Origin', 'http://localhost:8080');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Authorization');
  }
}

exports.ifDataGet = (req, res) => {
  checkLocal(res);

  switch (req.method) {
    case 'OPTIONS':
      res.send();
      return;
      break;
    case 'GET':

      /*  Require authentication header.
          Assumption is made that validationing of the authorisation
          header is done on API-GW level. Locally jwt is accepted
          without any validations or verifications.
      */
      if (!req.get('Authorization') &&
        !req.get('X-Endpoint-API-UserInfo')) {
          return res.status(401)
            .send("Authentication required");
      }

      if (req.path == "/mySensors") {
        return res.send(getMySensors(req));
      }

      if (req.path == "/userSelf") {
        return res.send(getClaims(req));
      }

      if (req.path == "/sensorSingle") {

          if (!req.query.tagId) {
            return res.status(400).send({
              error: 'missing data',
              cause: 'tagId parameter missing'
            });
          }

          if (!isOwner(req, req.query.tagId)) {
            return res.status(403).send({
              error: 'not allowed',
              cause: 'you are not allowed to access this data'
            });
          }

          getTagdata(1, config.temp.kind,
            req.query.tagId)
            .then((data) => {
              res.send(data[0]);
            })
            .catch((responseStr) => {
              res.status(500).send(responseStr);
            });
            return;
      }

      if (req.path == "/sensorData") {

          if (!req.query.tagId) {
            res.status(400).send({
              error: 'missing data',
              cause: 'tagId parameter missing'
            })
            return;
          }

          if (!isOwner(req, req.query.tagId)) {
            return res.status(403).send({
              error: 'not allowed',
              cause: 'you are not allowed to access this data'
            });
          }

          getTagdata(config.temp.getLimit, req.query.gran,
            req.query.tagId)
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
            return;
      }

      if (req.path == "/ifData") {

        if (!isAdmin(getUser(req))) {
          return res.status(403).send({
            error: 'not allowed',
            cause: 'you are not allowed to access this data'
          });
        }

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
          return;
      }
      console.log("nothing at path: " + req.path);
      res.status(400).send("Nothing to do at path: " + req.path);
      break;
    default:
      res.status(400).send('Method not supported');
  }

};

function getTagdata(limit, gran, tagId) {

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
      .filter('tagId', '=', tagId)
      .order('fDate', {
        descending: true
      })
      .limit(myLimit)
      .run((err, entities) => {
        if (err) {
          console.log({ error: 'datastore error',
            status: 'error',
            err: err});
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

function getUser(req) {
  return getClaims(req).sub;
}

function getClaims(req) {
  var jwt;
  if (!process.env.K_SERVICE) {
    let jwtStr = /Bearer [\w-_]*\.(\w*)\.[\w-_]*/.exec(req.get('Authorization'))[1];
    jwt = JSON.parse(Base64.decode(jwtStr));
  } else {
    jwt = JSON.parse(Base64.decode(req.get('X-Endpoint-API-UserInfo')));
  }
  if (isAdmin(jwt.sub)) {
    jwt['isAdmin'] = true;
  }
  return jwt;
}

function isAdmin(userId) {
  return userId == process.env.A_USER ? true : false;
}

function isOwner(req, tagId) {
  let user = getUser(req);
  return getMySensors(req).find(item => {
    if (item.tagId == tagId &&
        item.owner == user) {
          return true;
        }
    });
}

function getMySensors(req) {
  if (isAdmin(getUser(req))) {
    return [
      {
        tagId: 'abababababab9a',
        tagName: 'Tag 1',
        owner: process.env.A_USER
      },
      {
        tagId: 'ababababababbd',
        tagName: 'Tag 2',
        owner: process.env.A_USER
      }
    ];
  } else {
    return [];
  }

}
