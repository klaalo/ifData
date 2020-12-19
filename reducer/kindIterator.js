/*

  Node.js v12 function to iterate through
  Datastore entities of a kind and update
  the entity by adding a property.

  This is only a one time operation to
  update missing piece of information in entity
  that was not added in the first place.
  But the function will be left as an example
  even if unused in day to day operations.

  Make note that if a property is not defined
  for an entity in Datastore, it can't be
  used as filter argument in query operation.
  More information at:
  https://stackoverflow.com/questions/45013364/datastore-select-from-entity-where-property-is-null-returns-no-result-despi

*/

const config = require('./config.json');

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



exports.iterate = (kind) => {
  let n = 10;
  queryBatch(kind, n);

}


function queryBatch(kind, n, end) {
  if (n > 0) {
    console.log({
      end: end,
      n: n});
    n--;
    let query = datastore.createQuery(kind);
    if (typeof end == 'undefined') {
      return query
        .order('fDate', {
          descending: false
        })
        .limit(50)
        .run()
          .then((data) => thenBatch(data, kind, n));
    } else {
      return query
        .order('fDate', {
          descending: false
        })
        .start(end)
        .limit(50)
        .run()
          .then((data) => thenBatch(data, kind, n));
    }
  }
}

function thenBatch(data, kind, n) {
  let end = data[1].endCursor;
  let entities = data[0];

  console.log("entities amount: " + entities.length);
  if (entities.length < 1) {
    return;
  }

  let saveEntities = new Array();
  while (entities.length > 0) {
    let entity = entities.shift();
    let key = entity[Object.getOwnPropertySymbols(entity)[0]];
    console.log(key);
    console.log(entity);

    if (typeof entity.tagId == 'undefined') {

      let newData = {
        n: entity.n,
        humidityAvg: entity.humidityAvg,
        fDate: entity.fDate,
        temperatureAvg: entity.temperatureAvg,
        pressureAvg: entity.pressureAvg,
        tagId: 'tagId'
      }
      console.log({
        newData: newData});
      let newEntity = {
        key: key,
        data: newData
      }

      saveEntities.push(newEntity);
    }
  }
  if (saveEntities.length > 0) {
    datastore.update(saveEntities)
      .then((apiResponse) =>{
          console.log({
            "saveResponse.mutationResults": apiResponse[0].mutationResults
          });

      });
  } else {
    queryBatch(kind, n, end);
  }
}
