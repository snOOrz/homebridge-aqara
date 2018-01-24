const LightSwitchCommander = require('../commanders/LightSwitchCommander');

// 86 switch data parser
EightySixSwitchParser = function (platform) {
    this.platform = platform;
    this.factory = platform.factory;
    this.commanders = {};
}

EightySixSwitchParser.prototype.parse = function (report, rinfo) {
    var deviceSid = report['sid'];
    var gatewaySid = this.platform.gatewaySids[deviceSid];
    var data = JSON.parse(report['data']);

    // channel_0 can be two states: click, double_click
    if (data['channel_0'] === 'unknown') {
        this.platform.log.warn("warn %s(sid:%s):channel_0's state is unknown, ignore it.", report['model'], deviceSid);
    } else {
        var commander;

        if (deviceSid in this.commanders) {
            commander = this.commanders[deviceSid];
        } else {
            commander = new LightSwitchCommander(this.platform, deviceSid, report['model'], 'channel_0');
            this.commanders[deviceSid] = commander;
        }

        commander.toggleValue();
        this.factory.setLightSwitch(gatewaySid, deviceSid, 'LW' + deviceSid, commander.getLastValue(), commander);
    }
}

EightySixSwitchParser.modelName = '86sw1';

module.exports = EightySixSwitchParser;