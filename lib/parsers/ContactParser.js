// Contact/Magnet sensor data parser
ContactParser = function (platform) {
    this.platform = platform;
    this.factory = platform.factory;
}

ContactParser.prototype.parse = function (report, rinfo) {
    var deviceSid = report['sid'];
    var gatewaySid = this.platform.gatewaySids[deviceSid];
    var data = JSON.parse(report['data']);
    var contacted = (data['status'] === 'close');

    this.factory.setContact(gatewaySid, deviceSid, contacted);
}

ContactParser.modelName = ['magnet', 'sensor_magnet.aq2'];

module.exports = ContactParser;