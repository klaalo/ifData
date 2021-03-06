TagSocket
=========

TagSockect is a small node.js server module that listens to a socket and emits [Ruuvitag](https://ruuvi.com) data events to all clients connected to it.

Tested with:
* [ifDataPut Data Collector](../)
* Forked  [homebridge-ruuvitag](https://github.com/klaalo/homebridge-ruuvitag) plugin

## Motivation

It seems that multiple [node-ruuvitag](https://github.com/pakastin/node-ruuvitag) instances are not able to listen a bluetooth beacon on a single bluetooth adapter. Also, it may be desirable to separate bluetooth listener from the data collection to separate hosts in the TCP/IP network.

## Security

Socket server doesn't have any added security features like authentication or authorisation. Tag data is broadcasted with [BLE](https://en.wikipedia.org/wiki/Bluetooth_Low_Energy) in any case, so broadcasting it in local area network doesn't make much of a difference. <b>Make note however</b> that exposing your services in your local network to wider audience might open new security issues.
