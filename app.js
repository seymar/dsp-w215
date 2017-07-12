/**
 * Dependencies
 */
var MQTTService = require('mqtt-service');
var DSPW215 = require('dsp-w215-hnap');

/**
 * Config
 */
var config = {
  meters: [
    {
      "url": "10.0.0.1",
      "user": "admin",
      "pincode": "123456",
    },
    {
      "url": "10.0.0.2",
      "user": "admin",
      "pincode": "123456",
    }
  ],
  pollInterval: 1000
}

//var dspw215s = [];

config.meters.forEach(function(meter, i) {
  var dspw215 = new DSPW215(meter.url);

  // Login
  dspw215.login(meter.user, meter.pincode).done(function(status) {
    if(status == 'success') {
      console.log('Connected to meter #' + i + ' (' + meter.url + ')');
      
      startPolling(dspw215);
    } else {
      throw new Error('No connection to meter #' + i + ' (' + meter.url + ')');
    }
  });

  function startPolling(meterObj) {
    // Start polling
    setInterval(() => {
      meterObj.consumption().done(function (power) {
        meterObj.temperature().done(function (temperature) {
          meterObj.totalConsumption().done(function (totalConsumption) {
            console.log(new Date().toLocaleString(), power, temperature, totalConsumption);
          });
        });
      })
    }, config.pollInterval);
  }
});
