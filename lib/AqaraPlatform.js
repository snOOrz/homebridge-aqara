var fs = require("fs");
var path = require('path');
const dgram = require('dgram');
const crypto = require('crypto');
const iv = Buffer.from([0x17, 0x99, 0x6d, 0x09, 0x3d, 0x28, 0xdd, 0xb3, 0xba, 0x69, 0x5a, 0x2e, 0x6f, 0x58, 0x56, 0x2e]);
const serverSocket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true
});
const multicastAddress = '224.0.0.50';
const multicastPort = 4321;
const serverPort = 9898;
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
    this.factory = new AqaraAccessoryFactory(log, config, api);
    this.parsers = {};

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

    // Load parsers
    this.loadParsers();

    // Start UDP server to communicate with Aqara gateways
    this.startServer();

    // Something else to do
    this.doRestThings(api);
}

AqaraPlatform.prototype.loadConfig = function (config) {
    // Load cipher password for each gateway from HomeBridge's config.json
    var sid = config['sid'];
    var password = config['password'];
    if (sid.length !== password.length) {
        throw new Error('Number of SIDs must equal to the one of passwords.');
    }
    this.passwords = password.reduce(function (passwords, password, index) {
        passwords[sid[index]] = password;
        // log.debug("Load password %s:%s from config.json file", sid[index], password);
        return passwords;
    }, {});

    this.sensorNames = config['sensor_names'];
}

AqaraPlatform.prototype.doRestThings = function (api) {
    var that = this;

    if (api) {
        // Save the API object as plugin needs to register new accessory via this object.
        this.api = api;

        this.api.on('didFinishLaunching', function () {
            // Send whois to discovery Aqara gateways and resend every 300 seconds
            var whoisCommand = '{"cmd": "whois"}';
            that.log.debug("send %s to %s:%d", whoisCommand, multicastAddress, multicastPort);
            serverSocket.send(whoisCommand, 0, whoisCommand.length, multicastPort, multicastAddress);

            setInterval(function () {
                that.log.debug("send %s to %s:%d", whoisCommand, multicastAddress, multicastPort);
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
    } else if (cmd === 'write_ack') {
    } else {
        var model = json['model'];

        if (model in this.parsers) {
            this.parsers[model].parse(json, rinfo, serverSocket);
        }
    }
}

// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
AqaraPlatform.prototype.configureAccessory = function (accessory) {
    this.factory.configureAccessory(accessory);
}

AqaraPlatform.prototype.loadParsers = function () {
    var that = this;
    var parsersPath = path.resolve(__dirname, './parsers');
    that.log.debug('loading parsers from %s', parsersPath);
    fs.readdir(parsersPath, function (err, files) {
        if (err) {
            return;
        }
        files.forEach(function (filename) {
            var parserPath = path.join(parsersPath, filename);
            try {
                var parser = require(parserPath);
                var parserSupportModel = parser && parser.modelName;
                if (!parserSupportModel) return;
                if (parserSupportModel instanceof Array) {
                    parserSupportModel.forEach(function (model) {
                        that.parsers[model] = new parser(that);
                        that.log.debug(model);
                    });
                } else {
                    that.parsers[parserSupportModel] = new parser(that);
                    that.log.debug(parserSupportModel);
                }
            } catch (error) {
                that.log.error(error);
            }
        });
    });
}

AqaraPlatform.prototype.sendCommand = function (deviceSid, command) {
    var remoteAddress = this.gatewayAddress[deviceSid];
    var remotePort = this.gatewayPort[deviceSid];
    var gatewaySid = this.gatewaySids[deviceSid];
    var password = this.passwords[gatewaySid];
    var cipher = crypto.createCipheriv('aes-128-cbc', password, iv);
    var gatewayToken = this.gatewayTokens[gatewaySid];
    this.log.debug("cipher gateway %s, device %s, password %s", gatewaySid, deviceSid, password);

    var key = "hello";
    if (cipher && gatewayToken) {
        key = cipher.update(gatewayToken, "ascii", "hex");
        cipher.final('hex'); // Useless data, don't know why yet.
    }
    command.data && (command.data.key = key);
    var commandStr = JSON.stringify(command);
    serverSocket.send(commandStr, 0, commandStr.length, remotePort, remoteAddress);
}