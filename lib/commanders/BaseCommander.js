// Base commander
BaseCommander = function () {
    this.lastValue = null;
}

BaseCommander.prototype.init = function (platform, deviceSid, deviceModel) {
    this.platform = platform;
    this.deviceModel = deviceModel;
    this.deviceSid = deviceSid;
}

BaseCommander.prototype.update = function (value) {
    this.lastValue = value;
}

BaseCommander.prototype.getLastValue = function () {
    return this.lastValue;
}

module.exports = BaseCommander;