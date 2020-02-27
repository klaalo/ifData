TagSocket
=========

TagSockect is a small node.js server module that listens to a socket and emits [Ruuvitag](https://ruuvi.com) data events to all clients connected to it.

Tested with:
* [ifDataPut Data Collector](../)
* Forked  [homebridge-ruuvitag](https://github.com/klaalo/homebridge-ruuvitag) plugin

## Motivation

It seems that multiple [node-ruuvitag](https://github.com/pakastin/node-ruuvitag) instances are not able to listen a bluetooth beacon on a single bluetooth adapter. Also, it may be desirable to separate data collection on separate hosts in the TCP/IP network.
