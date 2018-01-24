const LightSwitchCommander = require('../commanders/LightSwitchCommander');

// Plug data parser
PlugSwitchParser = function (platform) {
    this.platform = platform;
    this.factory = platform.factory;
    this.commanders = {};
}

PlugSwitchParser.prototype.parse = function (report, rinfo) {
    var deviceSid = report['sid'];
    var gatewaySid = this.platform.gatewaySids[deviceSid];
    var data = JSON.parse(report['data']);

    // status can be three states: on, off, unknown.
    // we can't do anything when state is unknown, so just ignore it.
    if (data['status'] === 'unknown') {
        this.platform.log.warn("warn %s(sid:%s):status's state is unknown, ignore it.", report['model'], deviceSid);
    } else {
        var on = (data['status'] === 'on');
        var commander;

        if (deviceSid in this.commanders) {
            commander = this.commanders[deviceSid];
        } else {
            commander = new LightSwitchCommander(this.platform, deviceSid, report['model'], 'status');
            this.commanders[deviceSid] = commander;
        }

        commander.update(on);
        this.factory.setPlugSwitch(gatewaySid, deviceSid, 'PLUG' + deviceSid, on, commander);
    }
}

PlugSwitchParser.modelName = ['plug', '86plug'];

module.exports = PlugSwitchParser;