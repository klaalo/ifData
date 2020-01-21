exports.countData = (entities) => {
  var data = new Array();
  var keys = new Array();
  while (entities.length > 1) {
    var first = entities.shift();
    keys.push(first[Object.getOwnPropertySymbols(first)[0]]);
    var secs = (new Date(first.date) -
    new Date(entities[0].date)) / 1000;
    var outCounterNulled = false;
    var outOctets = first.outCount - entities[0].outCount;

    /*
        If octetcount is below zero, we assume the counter
        has wrapped. 32-bit counter has 5.7 minutes wrap time
        with 10 Mbps stream.
        https://www.cisco.com/c/en/us/support/docs/ip/simple-network-management-protocol-snmp/26007-faq-snmpcounter.html
    */
    if (outOctets < 0) {
      outOctets = (2**32 - entities[0].outCount) + first.outCount
      outCounterNulled = true;
    }
    var inCounterNulled = false;
    var inOctets = first.inCount - entities[0].inCount;
    if (inOctets < 0) {
      inOctets = (2**32 - entities[0].inCount) + first.inCount
      inCounterNulled = true;
    }
    var speedOut = outOctets / secs / 131072; // megabit
    var speedIn = inOctets / secs / 131072; // megabit
    data.push({
      date: first.date,
      secs: secs,
      inOctets: inOctets,
      outOctets: outOctets,
      in: speedIn,
      out: speedOut,
      inReading: first.inCount,
      outReading: first.outCount,
      inPrevReading: entities[0].inCount,
      outPrevReading: entities[0].outCount,
      inCounterNulled: inCounterNulled,
      outCounterNulled: outCounterNulled
    });
  }
  keys.push(entities[0][Object.getOwnPropertySymbols(first)[0]]);
  return {data: data, keys: keys };
}

exports.divided = (entities) => {
  var data = new Array();
  while (entities.length > 1) {
    var ent = entities.shift();
    data.push({
      date: ent.date,
      in: ent.in / 1073741824, // gibioctet
      out: ent.out / 1073741824 // gibioctet
    })
  }
  return { data: data };
}
