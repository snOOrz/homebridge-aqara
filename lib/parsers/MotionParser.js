// Motion sensor data parser
MotionParser = function (platform) {
    this.platform = platform;
    this.factory = platform.factory;
}

MotionParser.prototype.parse = function (report, rinfo) {
    var deviceSid = report['sid'];
    var gatewaySid = this.platform.gatewaySids[deviceSid];
    var data = JSON.parse(report['data']);
    var motionDetected = (data['status'] === 'motion');

    this.factory.setMotion(gatewaySid, deviceSid, motionDetected);
}

MotionParser.modelName = 'motion';

module.exports = MotionParser;