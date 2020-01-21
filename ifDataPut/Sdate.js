// https://www.webnms.com/snmp/help/snmpapi/snmpv3/using_mibs_in_applns/tcs_dateandtime.html
// https://www.snbforums.com/threads/snmp-oid-iso-3-6-1-4-1-2021-100-4-0-current-date-and-time-issue.36988/

module.exports = class Sdate {

  constructor (octD) {
    this.year = parseInt("0x" + octD.substring(0,4));
    this.month = parseInt("0x" + octD.substring(4,6));
    this.day = parseInt("0x" + octD.substring(6,8));
    this.hour = parseInt("0x" + octD.substring(8,10));
    this.min = parseInt("0x" + octD.substring(10,12));
    this.sec = parseInt("0x" + octD.substring(12,14));
    this.desisec = parseInt("0x" + octD.substring(14,16));
    this.offsetDir = String.fromCharCode(parseInt("0x" + octD.substring(16,18)));
    this.offsetHrs = parseInt("0x" + octD.substring(18,20));
    this.offsetMins = parseInt("0x" + octD.substring(20,22));
  }

  getDateStr() {
    return this.getYear()
     + "-" + this.getMonth().pad(2)
     + "-" + this.getDay().pad(2)
     + " " + this.getHour().pad(2)
     + ":" + this.getMin().pad(2)
     + ":" + this.getSec().pad(2)
     + "." + this.getDesisec().pad(2)
     + "" + this.getOffsetDir() + this.getOffsetHrs().pad(2)
     + ":" + this.getOffsetMins().pad(2);
   }

  getYear() {
    return this.year;
  }
  getMonth() {
    return this.month;
  }
  getDay() {
    return this.day;
  }
  getHour() {
    return this.hour;
  }
  getMin() {
    return this.min;
  }
  getSec() {
    return this.sec;
  }
  getDesisec() {
    return this.desisec
  }
  getOffsetDir() {
    return this.offsetDir;
  }
  getOffsetHrs() {
    return this.offsetHrs;
  }
  getOffsetMins() {
    return this.offsetMins;
  }

}

// https://gist.github.com/endel/321925f6cafa25bbfbde
Number.prototype.pad = function(size) {
  var s = String(this);
  while (s.length < (size || 2)) {s = "0" + s;}
  return s;
}
