const LightSwitchCommander = require('../commanders/LightSwitchCommander');

// Duplex light switch data parser
DuplexLightSwitchParser = function (platform) {
    this.platform = platform;
    this.factory = platform.factory;
    this.commanders0 = {};
    this.commanders1 = {};
}

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
        commander = new LightSwitchCommander(this.platform, deviceSid, deviceModel, switchName);
        commanders[deviceSid] = commander;
    }

    commander.update(on);

    return commander;
}

DuplexLightSwitchParser.modelName = ['ctrl_neutral2', 'ctrl_ln2'];

module.exports = DuplexLightSwitchParser;