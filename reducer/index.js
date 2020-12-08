/*

  Node.js 12 function to reduce io metrics data
  stored in GCP Datastore.

  Author: karilaalo.fi

*/

const config = require('./config.json');

const summariser = require('./summariser.js');
const reducer = require('./reducer.js');



exports.reducer = (message, ctx, callback) => {
  console.log("running reducer function with message: " + message.data);
  console.log("entering summariser");
  summariser.run()
    .then((data) => {
      if (config.general.debug) {
        console.log({ status: "success",
          message: data});
      }
      console.log("summariser run complete");
      console.log("entering reducer");
      return reducer.run();
    })
    .then((data) => {
      if (config.general.debug) {
        console.log({ status: "success",
          message: data});
      }
      console.log("reducer run complete");
      callback();
    })
    .catch((err) => {
      if (err.status == 'ok') {
        console.log({ status: 'ok',
        error: err});

        console.log("entering reducer");
        reducer.run()
          .then((data) => {
            if (config.general.debug) {
              console.log({ status: "success",
                message: data});
            }
            console.log("reducer run complete");
            callback();
          })
          .catch((err) => {
            console.log({ status: err.status,
            error: err});
            if (err.status == 'ok') {
              callback();
            } else {
              callback("error");
            };
          });

      } else {
        console.log({ status: "error",
          error: err });
          callback("error");
        }
    });
}
