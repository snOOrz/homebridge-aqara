const inherits = require('util').inherits;
var BaseCommander = require('./BaseCommander');

LightBrightnessCommander = function (platform, deviceSid, deviceModel, switchName) {
  this.init(platform, deviceSid, deviceModel);
  this.switchName = switchName;
}

inherits(LightBrightnessCommander, BaseCommander);

LightBrightnessCommander.prototype.send = function (brightness) {
  var targetRgbValue;
  if (typeof brightness === "string") {
    if (brightness === "on") {
      var lastValue = this.getLastValue();
      if (lastValue === undefined) {
        targetRgbValue = 0xFFFFFFFF;
        this.update(targetRgbValue);
      } else {
        targetRgbValue = lastValue;
      }
    } else {
      targetRgbValue = 0;
    }
  } else if (typeof brightness === "number") {
    targetRgbValue = (this.getLastValue() & 0x00FFFFFF) | (brightness << 24);
    this.update(targetRgbValue);
  } else {
    this.platform.log.error(util.format("unknown brightness type %s: %s",
      (typeof brightness), brightness));
      return;
  }

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
