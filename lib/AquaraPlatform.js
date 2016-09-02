var dgram = require('dgram');
var inherits = require('util').inherits;
var multicastAddress = '224.0.0.50';
var multicastPort = 4321;
var serverPort = 9898;
var AquaraAccessoryFactory;

module.exports = function(homebridge) {
  AquaraAccessoryFactory = require('./AquaraAccessoryFactory')(homebridge);

  // Register
  homebridge.registerPlatform("homebridge-aquara", "AquaraPlatform", AquaraPlatform, true);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function AquaraPlatform(log, config, api) {
  // Initialize
  this.log = log;
  this.config = config;
  this.factory = new AquaraAccessoryFactory(log, api);
  this.serverSocket = dgram.createSocket('udp4');
  this.parsers = {
    'sensor_ht' : new TemperatureAndHumidityParser(this.serverSocket, this.factory),
    'motion' : new MotionParser(this.serverSocket, this.factory),
    'magnet' : new ContactParser(this.serverSocket, this.factory),
    'ctrl_neutral1' : new LightSwitchParser(this.serverSocket, this.factory),
    'ctrl_neutral2' : new DuplexLightSwitchParser(this.serverSocket, this.factory)
  };

  this.commanders = {};

  // Start UDP server to communicate with Aquara gateways
  this.startServer();
}

AquaraPlatform.prototype.startServer = function() {
  var that = this;

  // Initialize a server socket for Aquara gateways.
  this.serverSocket.on('message', this.parseMessage.bind(this));

  // err - Error object, https://nodejs.org/api/errors.html
  this.serverSocket.on('error', function(err){
    that.log('error, msg - %s, stack - %s\n', err.message, err.stack);
  });

  // Show some message
  this.serverSocket.on('listening', function(){
    that.log("Aquara server is listening on port 9898.");
    that.serverSocket.addMembership(multicastAddress);
  });

  // Start server
  this.serverSocket.bind(serverPort);

  // Send whois to discovery Aquara gateways and resend every 30 seconds
  var whoisCommand = '{"cmd": "whois"}';
  this.serverSocket.send(whoisCommand, 0, whoisCommand.length, multicastPort, multicastAddress);

  setInterval(function() {
    that.serverSocket.send(whoisCommand, 0, whoisCommand.length, multicastPort, multicastAddress);
  }, 30000);
}

// Parse message which is sent from Aquara gateways
AquaraPlatform.prototype.parseMessage = function(msg, rinfo){
  var platform = this;
  var json;
  try {
    json = JSON.parse(msg);
  } catch (ex) {
    platform.log("Bad json %s", msg);
    return;
  }

  var cmd = json['cmd'];
  if (cmd === 'iam') {
    var address = json['ip'];
    var port = json['port'];
    var cmd = '{"cmd":"get_id_list"}';
    this.serverSocket.send(cmd, 0, cmd.length, port, address);
  } else if (cmd === 'get_id_list_ack') {
    var data = JSON.parse(json['data']);
    for(var index in data) {
      var sid = data[index];
      var response = '{"cmd":"read", "sid":"' + sid + '"}';
      this.serverSocket.send(response, 0, response.length, rinfo.port, rinfo.address);
    }
  } else {
    var model = json['model'];

    if (model in this.parsers) {
      this.parsers[model].parse(json, rinfo);
    }
  }
}

// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
AquaraPlatform.prototype.configureAccessory = function(accessory) {
  this.factory.configureAccessory(accessory);
}

// Base parser
BaseParser = function() {
  this.serverSocket = null;
  this.factory = null;
}

BaseParser.prototype.init = function(serverSocket, factory) {
  this.serverSocket = serverSocket;
  this.factory = factory;
}

// Tmeperature and humidity sensor data parser
TemperatureAndHumidityParser = function(serverSocket, factory) {
  this.init(serverSocket, factory);
}

TemperatureAndHumidityParser.prototype.parse = function(report) {
  var sensorID = report['short_id'].toString();
  var data = JSON.parse(report['data']);

  var temperature = data['temperature'] / 100.0;
  var humidity = data['humidity'] / 100.0;
  this.factory.setTemperatureAndHumidity(sensorID, temperature, humidity);
}

inherits(TemperatureAndHumidityParser, BaseParser);

// Motion sensor data parser
MotionParser = function(serverSocket, factory) {
  this.init(serverSocket, factory);
}

MotionParser.prototype.parse = function(report, rinfo) {
  var sensorID = report['short_id'].toString();
  var data = JSON.parse(report['data']);
  var motionDetected = (data['status'] === 'motion');

  this.factory.setMotion(sensorID, motionDetected);
}

inherits(MotionParser, BaseParser);

// Contact/Magnet sensor data parser
ContactParser = function(serverSocket, factory) {
  this.init(serverSocket, factory);
}

ContactParser.prototype.parse = function(report, rinfo) {
  var sensorID = report['short_id'].toString();
  var data = JSON.parse(report['data']);
  var contacted = (data['status'] === 'close');

  this.factory.setContact(sensorID, contacted);
}

inherits(ContactParser, BaseParser);

// Light switch data parser
LightSwitchParser = function(serverSocket, factory) {
  this.init(serverSocket, factory);
  this.commanders = {};
}

LightSwitchParser.prototype.parse = function(report, rinfo) {
  var sensorID = report['short_id'].toString();
  var data = JSON.parse(report['data']);
  var on = (data['channel_0'] === 'on');
  var commander;

  if (sensorID in this.commanders) {
    commander = this.commanders[sensorID];
  } else {
    commander = new LightSwitchCommander(this.serverSocket, report['sid'], report['model'], sensorID, 'channel_0');
    this.commanders[sensorID] = commander;
  }

  commander.update(rinfo, on);
  this.factory.setLightSwitch(sensorID, 'AquaraLight' + sensorID, on, commander);
}

inherits(LightSwitchParser, BaseParser);

// Duplex light switch data parser
DuplexLightSwitchParser = function(serverSocket, factory) {
  this.init(serverSocket, factory);
  this.commanders0 = {};
  this.commanders1 = {};
}

DuplexLightSwitchParser.prototype.parse = function(report, rinfo) {
  var sensorID = report['short_id'].toString();
  var data = JSON.parse(report['data']);
  var switchNames = ['channel_0', 'channel_1'];
  var uuidPrefix = ['AquaraLight0', 'AquaraLight1'];
  var commanders = [this.commanders0, this.commanders1];

  for (var index in switchNames) {
    var switchName = switchNames[index];
    if (switchName in data) {
      var on = (data[switchName] === 'on');
      var commander = this.parseInternal(sensorID, commanders[index], report, switchName, rinfo, on);
      this.factory.setLightSwitch(sensorID, uuidPrefix[index] + sensorID, on, commander);
    }
  }
}

DuplexLightSwitchParser.prototype.parseInternal = function(sensorID, commanders, report, switchName, rinfo, on) {
  var commander;

  if (sensorID in commanders) {
    commander = commanders[sensorID];
  } else {
    commander = new LightSwitchCommander(this.serverSocket, report['sid'], report['model'], sensorID, switchName);
    commanders[sensorID] = commander;
  }

  commander.update(rinfo, on);

  return commander;
}

inherits(DuplexLightSwitchParser, BaseParser);

// Base commander
BaseCommander = function() {
  this.token = 0;
  this.remotePort = 0;
  this.remoteAddress = null;
  this.lastValue = null;
}

BaseCommander.prototype.init = function(serverSocket, gatewayID, sensorModel, sensorID) {
  this.serverSocket = serverSocket;
  this.sensorModel = sensorModel;
  this.gatewayID = gatewayID;
  this.sensorID = sensorID;
  this.token = 0;
}

BaseCommander.prototype.update = function(rinfo, value) {
  this.remotePort = rinfo.port;
  this.remoteAddress = rinfo.address;
  this.lastValue = value;
}

BaseCommander.prototype.sendCommand = function(command) {
  this.serverSocket.send(command, 0, command.length, this.remotePort, this.remoteAddress);
  // Send twice to reduce UDP packet loss
  this.serverSocket.send(command, 0, command.length, this.remotePort, this.remoteAddress);
  this.token++;
}

// Commander for light switch
LightSwitchCommander = function(serverSocket, gatewayID, sensorModel, sensorID, switchName) {
  this.init(serverSocket, gatewayID, sensorModel, sensorID);
  this.switchName = switchName;
}

LightSwitchCommander.prototype.send = function(on) {
  // Due to some reason, this is called even when value is changed from accessory side.
  // TODO: Find out how to avoid this on root side.
  if (this.lastValue == on) {
    return; // Value not changed, do nothing
  }

  var command = '{"cmd":"write","model":"' + this.sensorModel
    + '","sid":"' + this.gatewayID
    + '","short_id":' + this.sensorID
    + ',"token":"' + this.token
    + '","data":"{"' + this.switchName + '":"' + (on ? 'on' : 'off') + '"}"}';

  this.sendCommand(command);
}

inherits(LightSwitchCommander, BaseCommander);
