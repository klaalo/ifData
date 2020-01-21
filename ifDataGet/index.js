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

const moment = require('moment');
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
  } else if (!req.query.gran) {
      res.status(400).send('Bad request');
      return;
  }

  switch (req.method) {
    case 'OPTIONS':
      res.send();
      return;
      break;
    case 'GET':
      if (req.query.out == 'chart') {
        get(req.query.gran)
          .then((data) => {
            res.send(formResponse(data));
          })
          .catch((responseStr) => {
            res.send(responseStr);
          });
      } else {
        get(req.query.gran)
          .then((data) => {
            res.send(data);
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
      var date = moment(element.date).format('LLL');
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

function isAllowed(req) {
  if (!req.get('X-Endpoint-API-UserInfo')) return false;
  var jwt = JSON.parse(Base64.decode(req.get('X-Endpoint-API-UserInfo')));
  return jwt.sub == process.env.A_USER ? true : false;
}
