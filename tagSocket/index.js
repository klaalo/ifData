const config = require('../config.json');

const ruuvi = require('node-ruuvitag');
const io = require('socket.io')();

var server = io.listen(config.tagSocket.port);

ruuvi.on('found', tag => {
    var tagId = tag.id;
    tag.on('updated', (data) => {
      data.tagId = tagId;
      server.sockets.emit('updated', data);
    });
});
