const inherits = require('util').inherits;
var BaseCommander = require('./BaseCommander');

LightBrightnessCommander = function (platform, deviceSid, deviceModel, switchName) {
  this.init(platform, deviceSid, deviceModel);
  this.switchName = switchName;
}

inherits(LightBrightnessCommander, BaseCommander);

LightBrightnessCommander.prototype.send = function (brightness) {
  var lastValue = this.getLastValue();

  if (lastValue == brightness) {
    platform.log.debug("Value not changed, do nothing");
    return;
  }

  var targetRgbValue = 0x00FFFFFF | (brightness << 24);
  var data = {
    rgb: targetRgbValue,
    key: this.generateKey()
  }
  var command = {
    cmd: "write",
    model: this.deviceModel,
    sid: this.deviceSid,
    data: JSON.stringify(data)
  }
  this.sendCommand(JSON.stringify(command));
}

module.exports = LightBrightnessCommander;
