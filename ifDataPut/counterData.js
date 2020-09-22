const snmp = require("net-snmp");
const config = require('../config.json');


const {
  StringDecoder
} = require('string_decoder');
const decoder = new StringDecoder('hex');

const ifInOctets = config.snmp.ifInOctets;
const ifOutOctets = config.snmp.ifOutOctets;
const ifDescr = config.snmp.ifDescr;
const hrSystemDate = config.snmp.hrSystemDate;



const Sdate = require('./Sdate.js');

exports.get = (ifIdx, host, community) => {

  var oids = [ifInOctets + "." + ifIdx,
    ifOutOctets + "." + ifIdx,
    ifDescr + "." + ifIdx,
    hrSystemDate
  ];
  var session = snmp.createSession(host, community);

  return new Promise((resolve, reject) => {
    session.get(oids, function(error, varbinds) {
      var retData = new Object();
      if (error) {
        console.error(error);
        session.close();
        reject(error);
      } else {
        for (var i = 0; i < varbinds.length; i++) {
          if (snmp.isVarbindError(varbinds[i])) {
            console.error(snmp.varbindError(varbinds[i]))
          } else {

            var oidStr = varbinds[i].oid;
            if (oidStr == hrSystemDate) {
              retData.date =
                new Sdate(decoder.write(varbinds[i].value))
                .getDateStr();
            } else if (oidStr.substring(0, oidStr.length - 2) == ifInOctets) {
              retData.inCount = varbinds[i].value;
            } else if (oidStr.substring(0, oidStr.length - 2) == ifOutOctets) {
              retData.outCount = varbinds[i].value;
            } else if (oidStr.substring(0, oidStr.length - 2) == ifDescr) {
              retData.ifDescr = String(varbinds[i].value);
            }
          }
        }
        session.close();
        retData.ifId = config.snmp.ifId + "-" + retData.ifDescr
        resolve(retData);
      }
    });
  });
}
