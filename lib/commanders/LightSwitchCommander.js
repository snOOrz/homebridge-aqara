const inherits = require('util').inherits;
const BaseCommander = require('./BaseCommander');

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

    var data = {};
    data[this.switchName] = (on ? "on" : "off");
    this.platform.sendCommand(this.deviceSid, {
        cmd: "write",
        model: this.deviceModel,
        sid: this.deviceSid,
        data: data
    });
}

module.exports = LightSwitchCommander;