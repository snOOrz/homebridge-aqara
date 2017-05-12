const inherits = require('util').inherits;
var BaseCommander = require('./BaseCommander');

// Commander for light switch
LightSwitchCommander = function (platform, deviceSid, deviceModel, switchName) {
  this.init(platform, deviceSid, deviceModel);
  this.switchName = switchName;
}

inherits(LightSwitchCommander, BaseCommander);

LightSwitchCommander.prototype.toggleValue = function () {
  this.lastValue = !this.lastValue;
}

LightSwitchCommander.prototype.send = function (on) {
  // Dont' send duplicate command out.
  if (this.lastValue == on) {
    this.platform.log.debug("Value not changed, do nothing");
    return;
  }

  var data = {
    key: this.generateKey()
  };
  data[this.switchName] = on ? 'on' : 'off';
  var cmdObj = {
    cmd: "write",
    model: this.deviceModel,
    sid: this.deviceSid,
    data: JSON.stringify(data)
  }

  var command = JSON.stringify(cmdObj)
  this.sendCommand(command);
}

module.exports = LightSwitchCommander;
