const LightSwitchCommander = require('../commanders/LightSwitchCommander');

// Duplex light switch data parser
DuplexEightySixSwitchParser = function (platform) {
    this.platform = platform;
    this.factory = platform.factory;
    this.commanders0 = {};
    this.commanders1 = {};
}

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
        commander = new LightSwitchCommander(this.platform, deviceSid, deviceModel, switchName);
        commanders[deviceSid] = commander;
    }

    commander.toggleValue();

    return commander;
}

DuplexEightySixSwitchParser.modelName = '86sw2';

module.exports = DuplexEightySixSwitchParser;