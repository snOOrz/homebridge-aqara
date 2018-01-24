// Tmeperature and humidity sensor data parser
TemperatureAndHumidityParser = function (platform) {
    this.platform = platform;
    this.factory = platform.factory;
}

TemperatureAndHumidityParser.prototype.parse = function (report) {
    var deviceSid = report['sid'];
    var gatewaySid = this.platform.gatewaySids[deviceSid];
    var data = JSON.parse(report['data']);

    var temperature = data['temperature'] / 100.0;
    var humidity = data['humidity'] / 100.0;
    this.factory.setTemperatureAndHumidity(gatewaySid, deviceSid, temperature, humidity);
}

TemperatureAndHumidityParser.modelName = 'sensor_ht';

module.exports = TemperatureAndHumidityParser;