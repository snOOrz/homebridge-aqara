const dgram = require('dgram');
const inherits = require('util').inherits;
const serverSocket = dgram.createSocket({
  type: 'udp4',
  reuseAddr: true
});
const multicastAddress = '224.0.0.50';
const multicastPort = 4321;
const serverPort = 9898;
const util = require('util');
const commander = require('./Commander');
var AqaraAccessoryFactory;

module.exports = function (homebridge) {
  AqaraAccessoryFactory = require('./AqaraAccessoryFactory')(homebridge);

  // Register
  homebridge.registerPlatform("homebridge-aqara", "AqaraPlatform", AqaraPlatform, true);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function AqaraPlatform(log, config, api) {
  // Initialize
  this.log = log;
  this.factory = new AqaraAccessoryFactory(this, config, api);
  this.parsers = {
    'sensor_ht': new TemperatureAndHumidityParser(this),
    'motion': new MotionParser(this),
    'magnet': new ContactParser(this),
    'ctrl_neutral1': new LightSwitchParser(this),
    'ctrl_neutral2': new DuplexLightSwitchParser(this),
    '86sw1': new EightySixSwitchParser(this),
    '86sw2': new DuplexEightySixSwitchParser(this),
    'plug': new PlugSwitchParser(this),
    'gateway': new GatewayParser(this)
  };

  // A lookup table to get cipher password from gateway/device sid.
  this.passwords = {};

  // A lookup table to find gateway sid from a device sid.
  // This is used when we sending a command to the gateway.
  this.gatewaySids = {};

  // A lookup table to get token from a gateway sid.
  this.gatewayTokens = {};

  // To get gateway's address from a device sid.
  this.gatewayAddress = {};

  // To get gateways' port from a device sid.
  this.gatewayPort = {};

  // Load passwords from config.json
  this.loadConfig(config);

  // Start UDP server to communicate with Aqara gateways
  this.startServer();

  // Something else to do
  this.doRestThings(api);
}

AqaraPlatform.prototype.loadConfig = function (config) {
  var log = this.log;
  // Load cipher password for each gateway from HomeBridge's config.json
  var sid = config['sid'];
  var password = config['password'];
  if (sid.length !== password.length) {
    throw new Error('Number of SIDs must equal to the one of passwords.');
  }
  this.passwords = password.reduce(function (passwords, password, index) {
    passwords[sid[index]] = password;
    log.debug("Load password %s:%s from config.json file", sid[index], password);
    return passwords;
  }, {});

  this.sensorNames = config['sensor_names'];
}

AqaraPlatform.prototype.doRestThings = function (api) {
  if (api) {
    var log = this.log;

    // Save the API object as plugin needs to register new accessory via this object.
    this.api = api;

    this.api.on('didFinishLaunching', function () {
      // Send whois to discovery Aqara gateways and resend every 300 seconds
      var whoisCommand = '{"cmd": "whois"}';
      log.debug("send %s to %s:%d", whoisCommand, multicastAddress, multicastPort);
      serverSocket.send(whoisCommand, 0, whoisCommand.length, multicastPort, multicastAddress);

      setInterval(function () {
        log.debug("send %s to %s:%d", whoisCommand, multicastAddress, multicastPort);
        serverSocket.send(whoisCommand, 0, whoisCommand.length, multicastPort, multicastAddress);
      }, 300000);
    });

    var factory = this.factory;
    // Check removed accessory every half hour.
    setInterval(function () {
      factory.autoRemoveAccessory();
    }, 1800000);
  } else {
    this.log.error("Homebridge's version is too old, please upgrade!");
  }
}

AqaraPlatform.prototype.registerGatewayAccessory = function (gatewaySid, address, port) {
  this.log.debug("Register Gateway Accessory");
  this.gatewaySids[gatewaySid] = gatewaySid;
  this.gatewayAddress[gatewaySid] = address;
  this.gatewayPort[gatewaySid] = port;

  this.factory.registerGatewayAccessory(this, gatewaySid);
}

AqaraPlatform.prototype.startServer = function () {
  var that = this;

  // Initialize a server socket for Aqara gateways.
  serverSocket.on('message', this.parseMessage.bind(this));

  // err - Error object, https://nodejs.org/api/errors.html
  serverSocket.on('error', function (err) {
    that.log.error('error, msg - %s, stack - %s\n', err.message, err.stack);
  });

  // Show some message
  serverSocket.on('listening', function () {
    that.log.debug("Aqara server is listening on port 9898.");
    serverSocket.addMembership(multicastAddress);
  });

  // Start server
  serverSocket.bind(serverPort);
}

// Parse message which is sent from Aqara gateways
AqaraPlatform.prototype.parseMessage = function (msg, rinfo) {
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
    var response = '{"cmd":"get_id_list"}';
    platform.log.debug("send %s to %s:%d", response, address, port);
    serverSocket.send(response, 0, response.length, port, address);

    // read gateway status
    var gatewaySid = json['sid'];
    this.registerGatewayAccessory(gatewaySid, address, port);

    var readGatewayCommand = {
      cmd: 'read',
      sid: gatewaySid,
    }
    var commandStr = JSON.stringify(readGatewayCommand);
    platform.log.debug("Read gateway status")
    platform.log.debug("send %s to %s:%d", commandStr, address, port);

    serverSocket.send(commandStr, 0, commandStr.length, port, address);

  } else if (cmd === 'get_id_list_ack') {
    var gatewaySid = json['sid'];
    var gatewayToken = json['token'];

    // Remember gateway's token
    this.gatewayTokens[gatewaySid] = gatewayToken;

    var data = JSON.parse(json['data']);
    for (var index in data) {
      var deviceSid = data[index];

      // Remember the device/gateway relation
      this.gatewaySids[deviceSid] = gatewaySid;
      this.gatewayAddress[deviceSid] = rinfo.address;
      this.gatewayPort[deviceSid] = rinfo.port;

      var response = '{"cmd":"read", "sid":"' + deviceSid + '"}';
      platform.log.debug("send %s to %s:%d", response, rinfo.address, rinfo.port);
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
  } else if (cmd === 'write_ack') {} else {
    var model = json['model'];

    if (model in this.parsers) {
      platform.log.debug(util.format("start parse %s msg, which sid is %s", model, json['sid']));
      this.parsers[model].parse(json, rinfo);
    }
  }
}

// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
AqaraPlatform.prototype.configureAccessory = function (accessory) {
  this.factory.configureAccessory(accessory);
}

// Base parser
BaseParser = function () {
  this.platform = null;
}

BaseParser.prototype.init = function (platform) {
  this.platform = platform;
  this.log = platform.log;
  this.factory = platform.factory;
  this._commanders = {};
}

BaseParser.prototype.getOrInitCommander = function (deviceSid, cmdInitCallback) {
  if (!(deviceSid in this._commanders)) {
    this._commanders[deviceSid] = cmdInitCallback();
  }
  return this._commanders[deviceSid];
}

// Tmeperature and humidity sensor data parser
TemperatureAndHumidityParser = function (platform) {
  this.init(platform);
}

inherits(TemperatureAndHumidityParser, BaseParser);

TemperatureAndHumidityParser.prototype.parse = function (report) {
  var deviceSid = report['sid'];
  var gatewaySid = this.platform.gatewaySids[deviceSid];
  var data = JSON.parse(report['data']);

  var temperature = data['temperature'] / 100.0;
  var humidity = data['humidity'] / 100.0;
  this.factory.setTemperatureAndHumidity(gatewaySid, deviceSid, temperature, humidity);
}

// Motion sensor data parser
MotionParser = function (platform) {
  this.init(platform);
}

inherits(MotionParser, BaseParser);

MotionParser.prototype.parse = function (report, rinfo) {
  var deviceSid = report['sid'];
  var gatewaySid = this.platform.gatewaySids[deviceSid];
  var data = JSON.parse(report['data']);
  var motionDetected = (data['status'] === 'motion');

  this.factory.setMotion(gatewaySid, deviceSid, motionDetected);
}


// Contact/Magnet sensor data parser
ContactParser = function (platform) {
  this.init(platform);
}

inherits(ContactParser, BaseParser);

ContactParser.prototype.parse = function (report, rinfo) {
  var deviceSid = report['sid'];
  var gatewaySid = this.platform.gatewaySids[deviceSid];
  var data = JSON.parse(report['data']);
  var contacted = (data['status'] === 'close');

  this.factory.setContact(gatewaySid, deviceSid, contacted);
}

// Light switch data parser
LightSwitchParser = function (platform) {
  this.init(platform);
  this.commanders = {};
}

inherits(LightSwitchParser, BaseParser);

LightSwitchParser.prototype.parse = function (report, rinfo) {
  var deviceSid = report['sid'];
  var gatewaySid = this.platform.gatewaySids[deviceSid];
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
      commander = new commander.LightSwitchCommander(this.platform, deviceSid, report['model'], 'channel_0');
      this.commanders[deviceSid] = commander;
    }

    commander.update(on);
    this.factory.setLightSwitch(gatewaySid, deviceSid, 'LW' + deviceSid, on, commander);
  }
}

// Duplex light switch data parser
DuplexLightSwitchParser = function (platform) {
  this.init(platform);
  this.commanders0 = {};
  this.commanders1 = {};
}

inherits(DuplexLightSwitchParser, BaseParser);

DuplexLightSwitchParser.prototype.parse = function (report, rinfo) {
  var deviceSid = report['sid'];
  var gatewaySid = this.platform.gatewaySids[deviceSid];
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
        this.factory.setLightSwitch(gatewaySid, deviceSid, uuidPrefix[index] + deviceSid, on, commander);
      }
    }
  }
}

DuplexLightSwitchParser.prototype.parseInternal = function (deviceSid, commanders, deviceModel, switchName, rinfo, on) {
  var commander;

  if (deviceSid in commanders) {
    commander = commanders[deviceSid];
  } else {
    commander = new commander.LightSwitchCommander(this.platform, deviceSid, deviceModel, switchName);
    commanders[deviceSid] = commander;
  }

  commander.update(on);

  return commander;
}



// 86 switch data parser
EightySixSwitchParser = function (platform) {
  this.init(platform);
  this.commanders = {};
}

inherits(EightySixSwitchParser, BaseParser);

EightySixSwitchParser.prototype.parse = function (report, rinfo) {
  var deviceSid = report['sid'];
  var gatewaySid = this.platform.gatewaySids[deviceSid];
  var data = JSON.parse(report['data']);

  // channel_0 can be two states: click, double_click
  if (data['channel_0'] === 'unknown') {
    this.platform.log.warn("warn %s(sid:%s):channel_0's state is unknown, ignore it.", report['model'], deviceSid);;
  } else {
    var commander;

    if (deviceSid in this.commanders) {
      commander = this.commanders[deviceSid];
    } else {
      commander = new commander.LightSwitchCommander(this.platform, deviceSid, report['model'], 'channel_0');
      this.commanders[deviceSid] = commander;
    }

    commander.toggleValue();
    this.factory.setLightSwitch(gatewaySid, deviceSid, 'LW' + deviceSid, commander.getLastValue(), commander);
  }
}



// Duplex light switch data parser
DuplexEightySixSwitchParser = function (platform) {
  this.init(platform);
  this.commanders0 = {};
  this.commanders1 = {};
}

inherits(DuplexEightySixSwitchParser, BaseParser);

DuplexEightySixSwitchParser.prototype.parse = function (report, rinfo) {
  var deviceSid = report['sid'];
  var gatewaySid = this.platform.gatewaySids[deviceSid];
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
        var commander = this.parseInternal(deviceSid, commanders[index], report['model'], switchName, rinfo);
        this.factory.setLightSwitch(gatewaySid, deviceSid, uuidPrefix[index] + deviceSid, commander.getLastValue(), commander);
      }
    }
  }
}

DuplexEightySixSwitchParser.prototype.parseInternal = function (deviceSid, commanders, deviceModel, switchName, rinfo) {
  var commander;

  if (deviceSid in commanders) {
    commander = commanders[deviceSid];
  } else {
    commander = new commander.LightSwitchCommander(this.platform, deviceSid, deviceModel, switchName);
    commanders[deviceSid] = commander;
  }

  commander.toggleValue();

  return commander;
}



// Plug data parser
PlugSwitchParser = function (platform) {
  this.init(platform);
  this.commanders = {};
}

inherits(PlugSwitchParser, BaseParser);

PlugSwitchParser.prototype.parse = function (report, rinfo) {
  var deviceSid = report['sid'];
  var gatewaySid = this.platform.gatewaySids[deviceSid];
  var data = JSON.parse(report['data']);
  var platform = this.platform;

  // channel_0 can be three states: on, off, unknown.
  // we can't do anything when state is unknown, so just ignore it.
  if (data['status'] === 'unknown') {
    this.platform.log.warn("warn %s(sid:%s):status's state is unknown, ignore it.", report['model'], deviceSid);
  } else {
    var on = (data['status'] === 'on');
    var commander;

    var commander = this.getOrInitCommander(deviceSid, function () {
      return new LightSwitchCommander(platform, deviceSid, report['model'], 'status')
    })
    commander.update(on);
    this.factory.setPlugSwitch(gatewaySid, deviceSid, 'PLUG' + deviceSid, on, commander);
  }
}

// Gateway data parser
GatewayParser = function (platform) {
  this.init(platform);
  this.commanders = {};
}

inherits(GatewayParser, BaseParser);

GatewayParser.prototype.parse = function (report, rinfo) {
  var deviceSid = report['sid'];
  var gatewaySid = report['sid']; // gateway's gateway sid is itself
  var data = JSON.parse(report['data']);

  // illumination
  if ('illumination' in data) {
    var illuminationValue = data['illumination'];
    this.factory.setIllumination(gatewaySid, deviceSid, illuminationValue);
  }
  if ('rgb' in data) {
    var rgbValue = data['rgb'];
    this.factory.setGatewayLight(gatewaySid, deviceSid, rgbValue);
  }
}
