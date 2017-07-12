var md5 = require('./hmac_md5');
var request = require('then-request');
var DOMParser = require('xmldom').DOMParser;
var fs = require("fs");
var AES = require('./AES');

var HNAP1_XMLNS = 'http://purenetworks.com/HNAP1/';
var HNAP_METHOD = 'POST';
var HNAP_BODY_ENCODING = 'UTF8';
var HNAP_LOGIN_METHOD = 'Login';

function DSPW215(url) {
  // Object to save login session
  this.HNAP_AUTH = {
    URL: 'http://' + url + '/HNAP1',
    User: '',
    Pwd: '',
    Result: '',
    Challenge: '',
    PublicKey: '',
    Cookie: '',
    PrivateKey: ''
  };
}

  // Login
  DSPW215.prototype.login = function (user, password) {
    var _self = this;

    this.HNAP_AUTH.User = user;
    this.HNAP_AUTH.Pwd = password;

    var loginRequest = "<Action>request</Action>"
        + "<Username>" + this.HNAP_AUTH.User + "</Username>"
        + "<LoginPassword></LoginPassword>"
        + "<Captcha></Captcha>";
    
    return request(HNAP_METHOD, _self.HNAP_AUTH.URL, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"' + HNAP1_XMLNS + HNAP_LOGIN_METHOD + '"'
      },
      body: requestBody(HNAP_LOGIN_METHOD, loginRequest)
    }).then(function (response) {
      var body = response.getBody(HNAP_BODY_ENCODING);
      var doc = new DOMParser().parseFromString(body);
      _self.HNAP_AUTH.Result = doc.getElementsByTagName(HNAP_LOGIN_METHOD + "Result").item(0).firstChild.nodeValue;
      _self.HNAP_AUTH.Challenge = doc.getElementsByTagName("Challenge").item(0).firstChild.nodeValue;
      _self.HNAP_AUTH.PublicKey = doc.getElementsByTagName("PublicKey").item(0).firstChild.nodeValue;
      _self.HNAP_AUTH.Cookie = doc.getElementsByTagName("Cookie").item(0).firstChild.nodeValue;
      _self.HNAP_AUTH.PrivateKey = md5.hex_hmac_md5(_self.HNAP_AUTH.PublicKey + _self.HNAP_AUTH.Pwd, _self.HNAP_AUTH.Challenge).toUpperCase();

      var login_pwd = md5.hex_hmac_md5(_self.HNAP_AUTH.PrivateKey, _self.HNAP_AUTH.Challenge);
      var loginParameters = "<Action>login</Action>"
          + "<Username>" + _self.HNAP_AUTH.User + "</Username>"
          + "<LoginPassword>" + login_pwd.toUpperCase() + "</LoginPassword>"
          + "<Captcha></Captcha>";

      return _self.soapAction(HNAP_LOGIN_METHOD, 'LoginResult', requestBody(HNAP_LOGIN_METHOD, loginParameters));
    }).catch(function (err) {
      console.log('error1:', err);
    });
  };

  DSPW215.prototype.soapAction = function(method, responseElement, body) {
    var _self = this;

    return request(HNAP_METHOD, this.HNAP_AUTH.URL,
      {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": '"' + HNAP1_XMLNS + method + '"',
          "HNAP_AUTH": getHnapAuth('"' + HNAP1_XMLNS + method + '"', this.HNAP_AUTH.PrivateKey),
          "Cookie": "uid=" + this.HNAP_AUTH.Cookie
        },
        body: body
      }).then(function (response) {
      return readResponseValue(response.getBody(HNAP_BODY_ENCODING), responseElement);
    }).catch(function (err) {
      console.log("error2:", err);
    });
  }

function requestBody(method, parameters) {
  return "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
    "<soap:Envelope " +
    "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " +
    "xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" " +
    "xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">" +
    "<soap:Body>" +
    "<" + method + " xmlns=\"" + HNAP1_XMLNS + "\">" +
    parameters +
    "</" + method + ">" +
    "</soap:Body></soap:Envelope>";
}

function moduleParameters(module) {
  return "<ModuleID>" + module + "</ModuleID>";
}

function controlParameters(module, status) {
  return moduleParameters(module) +
    "<NickName>Socket 1</NickName><Description>Socket 1</Description>" +
    "<OPStatus>" + status + "</OPStatus><Controller>1</Controller>";
}

function radioParameters(radio) {
  return "<RadioID>" + radio + "</RadioID>";
}

DSPW215.prototype.on = function () {
  return this.soapAction("SetSocketSettings", "SetSocketSettingsResult", requestBody("SetSocketSettings", controlParameters(1, true)));
};

DSPW215.prototype.off = function () {
  return this.soapAction("SetSocketSettings", "SetSocketSettingsResult", requestBody("SetSocketSettings", controlParameters(1, false)));
};

DSPW215.prototype.state = function () {
  return this.soapAction("GetSocketSettings", "OPStatus", requestBody("GetSocketSettings", moduleParameters(1)));
};

DSPW215.prototype.consumption = function () {
  return this.soapAction("GetCurrentPowerConsumption", "CurrentConsumption", requestBody("GetCurrentPowerConsumption", moduleParameters(2)));
};

DSPW215.prototype.totalConsumption = function () {
  return this.soapAction("GetPMWarningThreshold", "TotalConsumption", requestBody("GetPMWarningThreshold", moduleParameters(2)));
};

DSPW215.prototype.temperature = function () {
  return this.soapAction("GetCurrentTemperature", "CurrentTemperature", requestBody("GetCurrentTemperature", moduleParameters(3)));
};

DSPW215.prototype.getAPClientSettings = function () {
  return this.soapAction("GetAPClientSettings", "GetAPClientSettingsResult", requestBody("GetAPClientSettings", radioParameters("RADIO_2.4GHz")));
};

DSPW215.prototype.setPowerWarning = function () {
  return this.soapAction("SetPMWarningThreshold", "SetPMWarningThresholdResult", requestBody("SetPMWarningThreshold", powerWarningParameters()));
};

DSPW215.prototype.getPowerWarning = function () {
  return this.soapAction("GetPMWarningThreshold", "GetPMWarningThresholdResult", requestBody("GetPMWarningThreshold", moduleParameters(2)));
};

DSPW215.prototype.getTemperatureSettings = function () {
  return this.soapAction("GetTempMonitorSettings", "GetTempMonitorSettingsResult", requestBody("GetTempMonitorSettings", moduleParameters(3)));
};

DSPW215.prototype.setTemperatureSettings = function () {
  return this.soapAction("SetTempMonitorSettings", "SetTempMonitorSettingsResult", requestBody("SetTempMonitorSettings", temperatureSettingsParameters(3)));
};

DSPW215.prototype.getSiteSurvey = function () {
  return this.soapAction("GetSiteSurvey", "GetSiteSurveyResult", requestBody("GetSiteSurvey", radioParameters("RADIO_2.4GHz")));
};

DSPW215.prototype.triggerWirelessSiteSurvey = function () {
  return this.soapAction("SetTriggerWirelessSiteSurvey", "SetTriggerWirelessSiteSurveyResult", requestBody("SetTriggerWirelessSiteSurvey", radioParameters("RADIO_2.4GHz")));
};

DSPW215.prototype.latestDetection = function () {
  return this.soapAction("GetLatestDetection", "GetLatestDetectionResult", requestBody("GetLatestDetection", moduleParameters(2)));
};

DSPW215.prototype.reboot = function () {
  return this.soapAction("Reboot", "RebootResult", requestBody("Reboot", ""));
};

DSPW215.prototype.isDeviceReady = function () {
  return this.soapAction("IsDeviceReady", "IsDeviceReadyResult", requestBody("IsDeviceReady", ""));
};

DSPW215.prototype.getModuleSchedule = function () {
  return this.soapAction("GetModuleSchedule", "GetModuleScheduleResult", requestBody("GetModuleSchedule", moduleParameters(0)));
};

DSPW215.prototype.getModuleEnabled = function () {
  return this.soapAction("GetModuleEnabled", "GetModuleEnabledResult", requestBody("GetModuleEnabled", moduleParameters(0)));
};

DSPW215.prototype.getModuleGroup = function () {
  return this.soapAction("GetModuleGroup", "GetModuleGroupResult", requestBody("GetModuleGroup", groupParameters(0)));
};

DSPW215.prototype.getScheduleSettings = function () {
  return this.soapAction("GetScheduleSettings", "GetScheduleSettingsResult", requestBody("GetScheduleSettings", ""));
};

DSPW215.prototype.setFactoryDefault = function () {
  return this.soapAction("SetFactoryDefault", "SetFactoryDefaultResult", requestBody("SetFactoryDefault", ""));
};

DSPW215.prototype.getWLanRadios = function () {
  return this.soapAction("GetWLanRadios", "GetWLanRadiosResult", requestBody("GetWLanRadios", ""));
};

DSPW215.prototype.getInternetSettings = function () {
  return this.soapAction("GetInternetSettings", "GetInternetSettingsResult", requestBody("GetInternetSettings", ""));
};

DSPW215.prototype.setAPClientSettings = function () {
  return this.soapAction("SetAPClientSettings", "SetAPClientSettingsResult", requestBody("SetAPClientSettings", APClientParameters()));
};

DSPW215.prototype.settriggerADIC = function () {
  return this.soapAction("SettriggerADIC", "SettriggerADICResult", requestBody("SettriggerADIC", ""));
};

DSPW215.prototype.APClientParameters = function(group) {
  return "<Enabled>true</Enabled>" +
    "<RadioID>RADIO_2.4GHz</RadioID>" +
    "<SSID>My_Network</SSID>" +
    "<MacAddress>XX:XX:XX:XX:XX:XX</MacAddress>" +
    "<ChannelWidth>0</ChannelWidth>" +
    "<SupportedSecurity>" +
    "<SecurityInfo>" +
    "<SecurityType>WPA2-PSK</SecurityType>" +
    "<Encryptions>" +
    "<string>AES</string>" +
    "</Encryptions>" +
    "</SecurityInfo>" +
    "</SupportedSecurity>" +
    "<Key>" + AES.AES_Encrypt128("password", this.HNAP_AUTH.PrivateKey) + "</Key>";
}

function groupParameters(group) {
  return "<ModuleGroupID>" + group + "</ModuleGroupID>";
}
function temperatureSettingsParameters(module) {
  return moduleParameters(module) +
    "<NickName>TemperatureMonitor 3</NickName>" +
    "<Description>Temperature Monitor 3</Description>" +
    "<UpperBound>80</UpperBound>" +
    "<LowerBound>Not Available</LowerBound>" +
    "<OPStatus>true</OPStatus>";
}
function powerWarningParameters() {
  return "<Threshold>28</Threshold>" +
    "<Percentage>70</Percentage>" +
    "<PeriodicType>Weekly</PeriodicType>" +
    "<StartTime>1</StartTime>";
}

function getHnapAuth(SoapAction, privateKey) {
  var current_time = new Date();
  var time_stamp = Math.round(current_time.getTime() / 1000);
  var auth = md5.hex_hmac_md5(privateKey, time_stamp + SoapAction);
  return auth.toUpperCase() + " " + time_stamp;
}

function readResponseValue(body, elementName) {
  if (body && elementName) {
    var doc = new DOMParser().parseFromString(body);
    var node = doc.getElementsByTagName(elementName).item(0);
    // Check that we have children of node.
    return (node && node.firstChild) ? node.firstChild.nodeValue : "ERROR";
  }
}

module.exports = DSPW215;