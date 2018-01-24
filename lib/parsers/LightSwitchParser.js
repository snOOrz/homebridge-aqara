const LightSwitchCommander = require('../commanders/LightSwitchCommander');

// Light switch data parser
LightSwitchParser = function (platform) {
    this.platform = platform;
    this.factory = platform.factory;
    this.commanders = {};
}

LightSwitchParser.prototype.parse = function (report, rinfo, serverSocket) {
    var deviceSid = report['sid'];
    var gatewaySid = this.platform.gatewaySids[deviceSid];
    var data = JSON.parse(report['data']);

    // channel_0 can be three states: on, off, unknown.
    // we can't do anything when state is unknown, so just ignore it.
    if (data['channel_0'] === 'unknown') {
        this.platform.log.warn("warn %s(sid:%s):channel_0's state is unknown, ignore it.", report['model'], deviceSid);
    } else {
        var on = (data['channel_0'] === 'on');
        var commander;

        if (deviceSid in this.commanders) {
            commander = this.commanders[deviceSid];
        } else {
            commander = new LightSwitchCommander(this.platform, deviceSid, report['model'], 'channel_0');
            this.commanders[deviceSid] = commander;
        }

        commander.update(on);
        this.factory.setLightSwitch(gatewaySid, deviceSid, 'LW' + deviceSid, on, commander);
    }
}

LightSwitchParser.modelName = ['ctrl_neutral1', 'ctrl_ln1'];

module.exports = LightSwitchParser;