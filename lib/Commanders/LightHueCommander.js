const inherits = require('util').inherits;
var BaseCommander = require('./BaseCommander');


LightHueCommander = function (platform, deviceSid, deviceModel, switchName) {
  this.init(platform, deviceSid, deviceModel);
  this.switchName = switchName;
}

inherits(LightHueCommander, BaseCommander);

LightHueCommander.prototype.send = function (rgbValue) {
  var lastValue = this.getLastValue();

  if (lastValue == rgbValue) {
    platform.log.debug("Value not changed, do nothing");
    return;
  }

  var lastBrightness = (lastValue & 0xFF000000) >>> 24;
  var rgbHue = Math.round((rgbValue & 0x00FFFFFF) / 0x00FFFFFF * 360);
  var targetRgbValue = rgbHue & (lastBrightness << 24);
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
  this.sendCommand(command);
}

module.exports = LightHueCommander;
