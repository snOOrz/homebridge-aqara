const dgram = require('dgram');
const inherits = require('util').inherits;
const crypto = require('crypto');
const iv = Buffer.from([0x17, 0x99, 0x6d, 0x09, 0x3d, 0x28, 0xdd, 0xb3, 0xba, 0x69, 0x5a, 0x2e, 0x6f, 0x58, 0x56, 0x2e]);
const serverSocket = dgram.createSocket('udp4');
const multicastAddress = '224.0.0.50';
const multicastPort = 4321;
const serverPort = 9898;
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
  this.factory = new AquaraAccessoryFactory(log, api);
  this.parsers = {
    'sensor_ht' : new TemperatureAndHumidityParser(this),
    'motion' : new MotionParser(this),
    'magnet' : new ContactParser(this),
    'ctrl_neutral1' : new LightSwitchParser(this),
    'ctrl_neutral2' : new DuplexLightSwitchParser(this)
  };

  // A lookup table to get cipher password from gateway/device sid.
  this.passwords = {};

  // Load ciphers for each gateway from HomeBridge's config.json
  var sid = config['sid'];
  var password = config['password'];
  if (sid && password) {
    for (var index in password) {
      this.passwords[sid[index]] = password[index];
    }
  }

  // A lookup table to find gateway sid from a device sid.
  // This is used when we sending a command to the gateway.
  this.gatewaySids = {};

  // A lookup table to get token from a gateway sid.
  this.gatewayTokens = {};

  this.commanders = {};

  // Start UDP server to communicate with Aquara gateways
  this.startServer();
}

AquaraPlatform.prototype.startServer = function() {
  var that = this;

  // Initialize a server socket for Aquara gateways.
  serverSocket.on('message', this.parseMessage.bind(this));

  // err - Error object, https://nodejs.org/api/errors.html
  serverSocket.on('error', function(err){
    that.log.error('error, msg - %s, stack - %s\n', err.message, err.stack);
  });

  // Show some message
  serverSocket.on('listening', function(){
    that.log.debug("Aquara server is listening on port 9898.");
    serverSocket.addMembership(multicastAddress);
  });

  // Start server
  serverSocket.bind(serverPort);

  // Send whois to discovery Aquara gateways and resend every 30 seconds
  var whoisCommand = '{"cmd": "whois"}';
  serverSocket.send(whoisCommand, 0, whoisCommand.length, multicastPort, multicastAddress);

  setInterval(function() {
    serverSocket.send(whoisCommand, 0, whoisCommand.length, multicastPort, multicastAddress);
  }, 30000);
}

// Parse message which is sent from Aquara gateways
AquaraPlatform.prototype.parseMessage = function(msg, rinfo){
  var platform = this;
  platform.log.debug('recv %s(%d bytes) from client %s:%d\n', msg, msg.length, rinfo.address, rinfo.port);
  var json;
  try {
    json = JSON.parse(msg);
  } catch (ex) {
    platform.log.error("Bad json %s", msg);
    return;
  }

  var cmd = json['cmd'];
  if (cmd === 'iam') {
    var address = json['ip'];
    var port = json['port'];
    var cmd = '{"cmd":"get_id_list"}';
    serverSocket.send(cmd, 0, cmd.length, port, address);
  } else if (cmd === 'get_id_list_ack') {
    var gatewaySid = json['sid'];
    var gatewayToken = json['token'];

    // Remember gateway's token
    this.gatewayTokens[gatewaySid] = gatewayToken;

    var data = JSON.parse(json['data']);
    for(var index in data) {
      var deviceSid = data[index];

      // // Remember the device/gateway relation
      this.gatewaySids[deviceSid] = gatewaySid;
      // // Also create a shortcut to find cipher faster
      this.passwords[deviceSid] = this.passwords[gatewaySid];

      var response = '{"cmd":"read", "sid":"' + deviceSid + '"}';
      serverSocket.send(response, 0, response.length, rinfo.port, rinfo.address);
    }
  } else if (cmd === 'heartbeat') {
    var model = json['model'];
    if (model === 'gateway') {
      var gatewaySid = json['sid'];
      var gatewayToken = json['token'];
      // Remember gateway's token
      this.gatewayTokens[gatewaySid] = gatewayToken;
    }
  } else if (cmd === 'write_ack') {
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
  this.platform = null;
}

BaseParser.prototype.init = function(platform) {
  this.platform = platform;
  this.factory = platform.factory;
}

// Tmeperature and humidity sensor data parser
TemperatureAndHumidityParser = function(platform) {
  this.init(platform);
}

TemperatureAndHumidityParser.prototype.parse = function(report) {
  var deviceSid = report['sid'];
  var data = JSON.parse(report['data']);

  var temperature = data['temperature'] / 100.0;
  var humidity = data['humidity'] / 100.0;
  this.factory.setTemperatureAndHumidity(deviceSid, temperature, humidity);
}

inherits(TemperatureAndHumidityParser, BaseParser);

// Motion sensor data parser
MotionParser = function(platform) {
  this.init(platform);
}

MotionParser.prototype.parse = function(report, rinfo) {
  var deviceSid = report['sid'];
  var data = JSON.parse(report['data']);
  var motionDetected = (data['status'] === 'motion');

  this.factory.setMotion(deviceSid, motionDetected);
}

inherits(MotionParser, BaseParser);

// Contact/Magnet sensor data parser
ContactParser = function(platform) {
  this.init(platform);
}

ContactParser.prototype.parse = function(report, rinfo) {
  var deviceSid = report['sid'];
  var data = JSON.parse(report['data']);
  var contacted = (data['status'] === 'close');

  this.factory.setContact(deviceSid, contacted);
}

inherits(ContactParser, BaseParser);

// Light switch data parser
LightSwitchParser = function(platform) {
  this.init(platform);
  this.commanders = {};
}

LightSwitchParser.prototype.parse = function(report, rinfo) {
  var deviceSid = report['sid'];
  var data = JSON.parse(report['data']);

  // channel_0 can be three states: on, off, unknown.
  // we can't do anything when state is unknown, so just ignore it.
  if (data['channel_0'] === 'unknown') {
    this.platform.log.warn("warn %s(sid:%s):channel_0's state is unknown, ignore it.", report['model'], deviceSid);;
  } else {
    var on = (data['channel_0'] === 'on');
    var commander;

    if (deviceSid in this.commanders) {
      commander = this.commanders[deviceSid];
    } else {
      commander = new LightSwitchCommander(this.platform, deviceSid, report['model'], 'channel_0');
      this.commanders[deviceSid] = commander;
    }

    commander.update(rinfo, on);
    this.factory.setLightSwitch(deviceSid, 'AquaraLight' + deviceSid, on, commander);
  }
}

inherits(LightSwitchParser, BaseParser);

// Duplex light switch data parser
DuplexLightSwitchParser = function(platform) {
  this.init(platform);
  this.commanders0 = {};
  this.commanders1 = {};
}

DuplexLightSwitchParser.prototype.parse = function(report, rinfo) {
  var deviceSid = report['sid'];
  var data = JSON.parse(report['data']);
  var switchNames = ['channel_0', 'channel_1'];
  var uuidPrefix = ['LW0', 'LW1'];
  var commanders = [this.commanders0, this.commanders1];

  for (var index in switchNames) {
    var switchName = switchNames[index];
    if (switchName in data) {
      // There are three states: on, off, unknown.
      // We can't do anything when state is unknown, so just ignore it.
      if (data[switchName] === 'unknown') {
        this.platform.log.warn("warn %s(sid:%s):%s's state is unknown, ignore it.", report['model'], deviceSid, switchName);
      } else {
        var on = (data[switchName] === 'on');
        var commander = this.parseInternal(deviceSid, commanders[index], report['model'], switchName, rinfo, on);
        this.factory.setLightSwitch(deviceSid, uuidPrefix[index] + deviceSid, on, commander);
      }
    }
  }
}

DuplexLightSwitchParser.prototype.parseInternal = function(deviceSid, commanders, deviceModel, switchName, rinfo, on) {
  var commander;

  if (deviceSid in commanders) {
    commander = commanders[deviceSid];
  } else {
    commander = new LightSwitchCommander(this.platform, deviceSid, deviceModel, switchName);
    commanders[deviceSid] = commander;
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

BaseCommander.prototype.init = function(platform, deviceSid, deviceModel) {
  this.platform = platform;
  this.deviceModel = deviceModel;
  this.deviceSid = deviceSid;
}

BaseCommander.prototype.update = function(rinfo, value) {
  this.remotePort = rinfo.port;
  this.remoteAddress = rinfo.address;
  this.lastValue = value;
}

BaseCommander.prototype.sendCommand = function(command) {
  serverSocket.send(command, 0, command.length, this.remotePort, this.remoteAddress);
  this.platform.log.debug("send %s to %s:%d", command, this.remoteAddress, this.remotePort);
  // Send twice to reduce UDP packet loss
  // serverSocket.send(command, 0, command.length, this.remotePort, this.remoteAddress);
}

// Commander for light switch
LightSwitchCommander = function(platform, deviceSid, deviceModel, switchName) {
  this.init(platform, deviceSid, deviceModel);
  this.switchName = switchName;
}

LightSwitchCommander.prototype.send = function(on) {
  // Due to some reason, this is called even when value is changed from accessory side.
  // TODO: Find out how to avoid this on root side.
  if (this.lastValue == on) {
    return; // Value not changed, do nothing
  }

  var platform = this.platform;
  var cipher = crypto.createCipheriv('aes-128-cbc', platform.passwords[this.deviceSid], iv);
  var gatewaySid = platform.gatewaySids[this.deviceSid];
  var gatewayToken = platform.gatewayTokens[gatewaySid];
  var key = "hello";
  if (cipher && gatewayToken) {
    key = cipher.update(gatewayToken, "ascii", "hex");
    cipher.final('hex'); // Useless data, don't know why yet.
  }

  var command = '{"cmd":"write","model":"' + this.deviceModel + '","sid":"' + this.deviceSid + '","data":"{"' + this.switchName + '":"' + (on ? 'on' : 'off') + '", "key": "' + key + '"}"}';
  this.sendCommand(command);
}

inherits(LightSwitchCommander, BaseCommander);
