var dgram = require('dgram');
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
  this.parsers = {
    'sensor_ht' : new TemperatureAndHumidityParser(this.factory),
    'motion' : new MotionParser(this.factory),
    'magnet' : new ContactParser(this.factory)
  };

  // Start UDP server to communicate with Aquara gateways
  this.startServer();
}

AquaraPlatform.prototype.startServer = function() {
  var platform = this;
  var serverSocket = dgram.createSocket('udp4');

  // Initialize a server socket for Aquara gateways.
  serverSocket.on('message', this.parseMessage.bind(this));

  //    err - Error object, https://nodejs.org/api/errors.html
  serverSocket.on('error', function(err){
    platform.log('error, msg - %s, stack - %s\n', err.message, err.stack);
  });

  serverSocket.on('listening', function(){
    platform.log("Aquara server is listening on port 9898.");
  });

  // Start server
  serverSocket.bind(9898);
}

// Parse message which is sent from Aquara gateways
AquaraPlatform.prototype.parseMessage = function(msg, rinfo){
  var report = JSON.parse(msg);
  var model = report['model'];
  var sensorID = report['short_id'].toString();
  var data = JSON.parse(report['data']);

  if (model in this.parsers) {
    this.parsers[model].parse(sensorID, data);
  }
}

// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
AquaraPlatform.prototype.configureAccessory = function(accessory) {
  this.factory.configureAccessory(accessory);
}

// Tmeperature and humidity sensor data parser
TemperatureAndHumidityParser = function(factory) {
  this.factory = factory;
  this.cachedTemperature = {};
  this.cachedHumidity = {};
}

TemperatureAndHumidityParser.prototype.parse = function(sensorID, data) {
  if ('temperature' in data && 'humidity' in data) {
    var temperature = data['temperature'] / 100.0;
    var humidity = data['humidity'] / 100.0;
    if (!(sensorID in this.cachedTemperature) || (this.cachedTemperature[sensorID] != temperature) || (this.cachedHumidity[sensorID] != humidity)) {
      this.cachedTemperature[sensorID] = temperature;
      this.cachedHumidity[sensorID] = humidity;
      this.factory.setTemperatureAndHumidity(sensorID, temperature, humidity);
    }
  }
}

// Motion sensor data parser
MotionParser = function(factory) {
  this.factory = factory;
  this.cachedMotion = {};
}

MotionParser.prototype.parse = function(sensorID, data) {
  var motionDetected = (data['status'] === 'motion');
  if (!(sensorID in this.cachedMotion) || (this.cachedMotion[sensorID] != motionDetected)) {
    this.cachedMotion[sensorID] = motionDetected;
    this.factory.setMotion(sensorID, motionDetected);
  }
}

// Contact/Magnet sensor data parser
ContactParser = function(factory) {
  this.factory = factory;
  this.cachedContact = {};
}

ContactParser.prototype.parse = function(sensorID, data) {
  var contacted = (data['status'] === 'close');
  if (!(sensorID in this.cachedContact) || (this.cachedContact[sensorID] != contacted)) {
    this.cachedContact[sensorID] = contacted;
    this.factory.setContact(sensorID, contacted);
  }
}
