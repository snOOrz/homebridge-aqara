const crypto = require('crypto');
const iv = Buffer.from([0x17, 0x99, 0x6d, 0x09, 0x3d, 0x28, 0xdd, 0xb3, 0xba, 0x69, 0x5a, 0x2e, 0x6f, 0x58, 0x56, 0x2e]);
const dgram = require('dgram');
const serverSocket = dgram.createSocket('udp4');

// Base commander
BaseCommander = function () {
  this.lastValue = null;
}

BaseCommander.prototype.init = function (platform, deviceSid, deviceModel) {
  this.platform = platform;
  this.log = platform.log;
  this.deviceModel = deviceModel;
  this.deviceSid = deviceSid;
}

BaseCommander.prototype.update = function (value) {
  this.lastValue = value;
}

BaseCommander.prototype.getLastValue = function () {
  return this.lastValue;
}

BaseCommander.prototype.sendCommand = function (command) {
  var remoteAddress = this.platform.gatewayAddress[this.deviceSid];
  var remotePort = this.platform.gatewayPort[this.deviceSid];
  serverSocket.send(command, 0, command.length, remotePort, remoteAddress);
  this.platform.log.debug("send %s to %s:%d", command, remoteAddress, remotePort);
  // Send twice to reduce UDP packet loss
  // serverSocket.send(command, 0, command.length, remotePort, remoteAddress);
}

BaseCommander.prototype.generateKey = function () {
  var platform = this.platform;
  var gatewaySid = platform.gatewaySids[this.deviceSid];
  var password = platform.passwords[gatewaySid];

  // No password for this device, please edit ~/.homebridge/config.json
  if (!password) {
    platform.log.error("No password for gateway %s, please edit ~/.homebridge/config.json", gatewaySid);
    return;
  }
  var cipher = crypto.createCipheriv('aes-128-cbc', password, iv);
  var gatewayToken = platform.gatewayTokens[gatewaySid];
  platform.log.debug("cipher gateway %s, device %s, password %s", gatewaySid, this.deviceSid, password);
  var key = 'hello';
  if (cipher && gatewayToken) {
    key = cipher.update(gatewayToken, "ascii", "hex");
    cipher.final('hex'); // Useless data, don't know why yet.
  }
  return key;
}

module.exports = BaseCommander;
