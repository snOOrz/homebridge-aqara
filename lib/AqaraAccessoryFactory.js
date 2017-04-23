var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen, Factory;
var sensorNames;
const util = require('util');
const commander = require('./Commander');

module.exports = function (homebridge) {
  Accessory = homebridge.hap.Accessory;
  PlatformAccessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  return AqaraAccessoryFactory;
}

function AqaraAccessoryFactory(platform, config, api) {
  this.platform = platform;
  this.log = platform.log;
  this.config = config;
  this.api = api;
  this.accessories = [];
  this.gatewaySids = {};
  this.lastGatewayUpdateTime = {};
  this.lastDeviceUpdateTime = {};

  this.sensorNames = {};
  if (config['sensor_names']) {
    this.sensorNames = config['sensor_names'];
  }
}

// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
AqaraAccessoryFactory.prototype.configureAccessory = function (accessory) {
  this.log.debug(accessory.displayName, "Configure Accessory");
  var that = this;

  // set the accessory to reachable if plugin can currently process the accessory
  // otherwise set to false and update the reachability later by invoking
  // accessory.updateReachability()
  accessory.reachable = true;
  accessory.on('identify', function (paired, callback) {
    that.log(accessory.displayName + "* Identify!!!");
    callback();
  });

  // update accessory names from the config:
  if (this.sensorNames[accessory.displayName]) {
    var displayName = this.sensorNames[accessory.displayName];
    this.log('Resetting saved name ' + accessory.displayName + ' -> ' + displayName);
    accessory.displayName = displayName;
    var characteristic = accessory.getService(Service.AccessoryInformation)
      .getCharacteristic(Characteristic.Name);

    if (characteristic) {
      // that.log("Set %s %s", serviceName, characteristicValue);
      characteristic.updateValue(displayName);
    }
  }

  var modelName = accessory.getService(Service.AccessoryInformation)
    .getCharacteristic(Characteristic.Model).value;
  if (modelName == "Lumi Gateway") {
    this.registerGatewayCommander(this.platform, accessory);
  }

  this.accessories.push(accessory);
  this.lastDeviceUpdateTime[accessory.UUID] = Date.now();
}

AqaraAccessoryFactory.prototype.unregisterAccessory = function (accessory) {
  var factory = this;
  factory.accessories.forEach(function (acc, index) {
    if (acc.UUID === accessory.UUID) {
      factory.accessories.splice(index, 1);
      factory.api.unregisterPlatformAccessories("homebridge-aqara", "AqaraPlatform", [acc]);
    }
    return;
  });
}

// How long in milliseconds we can remove an accessory when there's no update.
// This is a little complicated:
// First, we need to make sure gateway is online, if the gateway is offline, we do nothing.
// Then, we measure the delta since last update time, if it's too long, remove it.
const DeviceAutoRemoveDelta = 3600 * 1000;
const GatewayAutoRemoveDelta = 24 * 3600 * 1000;
AqaraAccessoryFactory.prototype.autoRemoveAccessory = function () {
  var accessoriesToRemove = [];

  for (var i = this.accessories.length - 1; i--;) {
    var accessory = this.accessories[i];
    var gatewaySid = this.gatewaySids[accessory.UUID];
    var lastTime = this.lastDeviceUpdateTime[accessory.UUID];
    var removeFromGateway = gatewaySid && ((this.lastGatewayUpdateTime[gatewaySid] - lastTime) > DeviceAutoRemoveDelta);

    if (removeFromGateway || (Date.now() - lastTime) > GatewayAutoRemoveDelta) {
      this.log.debug("remove accessory %s", accessory.UUID);
      accessoriesToRemove.push(accessory);
      this.accessories.splice(i, 1);
    }
  }

  if (accessoriesToRemove.length > 0) {
    this.api.unregisterPlatformAccessories("homebridge-aqara", "AqaraPlatform", accessoriesToRemove);
  }
}

AqaraAccessoryFactory.prototype.setTemperatureAndHumidity = function (gatewaySid, deviceSid, temperature, humidity) {
  // Temperature
  isNaN(temperature) || this.findServiceAndSetValue(
    gatewaySid,
    deviceSid,
    UUIDGen.generate(deviceSid),
    Accessory.Categories.SENSOR,
    Service.TemperatureSensor,
    Characteristic.CurrentTemperature,
    temperature,
    null); // No commander

  // Humidity
  isNaN(humidity) || this.findServiceAndSetValue(
    gatewaySid,
    deviceSid,
    UUIDGen.generate(deviceSid),
    Accessory.Categories.SENSOR,
    Service.HumiditySensor,
    Characteristic.CurrentRelativeHumidity,
    humidity,
    null); // No commander
}

AqaraAccessoryFactory.prototype.setIllumination = function (gatewaySid, deviceSid, illuminationValue) {
  this.findServiceAndSetValue(
    gatewaySid,
    deviceSid,
    UUIDGen.generate(deviceSid),
    Accessory.Categories.SENSOR,
    Service.LightSensor,
    Characteristic.CurrentAmbientLightLevel,
    illuminationValue,
    null); // No commander
}

AqaraAccessoryFactory.prototype.setGatewayLight = function (gatewaySid, deviceSid, rgbValue) {
  var lightOn = rgbValue !== 0;
  var accessoryUUID = UUIDGen.generate(deviceSid)
  var brightness = (rgbValue & 0xFF000000) >>> 24;

  var red = (rgbValue & 0x00FF0000) >>> 16;
  var green = (rgbValue & 0x0000FF00) >>> 8;
  var blue = rgbValue & 0x000000FF;
  var rgbHue = (rgbValue & 0x00FFFFFF) / 0x00FFFFFF * 360;
  this.log.debug("set gateway light On char to " + lightOn);
  this.log.debug("set gateway light Bright:R:G:B to " +
    util.format("%s:%s:%s:%s", brightness, red, green, blue)
  );

  this.findServiceAndSetValue(
    gatewaySid,
    deviceSid,
    accessoryUUID,
    Accessory.Categories.LIGHTBULB,
    Service.Lightbulb,
    Characteristic.On,
    lightOn,
    null
  );

  this.findServiceAndSetValue(
    gatewaySid,
    deviceSid,
    accessoryUUID,
    Accessory.Categories.LIGHTBULB,
    Service.Lightbulb,
    Characteristic.Brightness,
    brightness,
    null
  );


  this.log.debug("ste gateway light hue to: " + rgbHue)
  this.findServiceAndSetValue(
    gatewaySid,
    deviceSid,
    accessoryUUID,
    Accessory.Categories.LIGHTBULB,
    Service.Lightbulb,
    Characteristic.Hue,
    rgbHue,
    null
  );
}

// Motion sensor
AqaraAccessoryFactory.prototype.setMotion = function (gatewaySid, deviceSid, motionDetected) {
  this.findServiceAndSetValue(
    gatewaySid,
    deviceSid,
    UUIDGen.generate('Mot' + deviceSid),
    Accessory.Categories.SENSOR,
    Service.MotionSensor,
    Characteristic.MotionDetected,
    motionDetected,
    null); // No commander
}

// Contact sensor
AqaraAccessoryFactory.prototype.setContact = function (gatewaySid, deviceSid, contacted) {
  this.findServiceAndSetValue(
    gatewaySid,
    deviceSid,
    UUIDGen.generate('Mag' + deviceSid),
    Accessory.Categories.SENSOR,
    Service.ContactSensor,
    Characteristic.ContactSensorState,
    contacted ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED,
    null); // No commander
}

// Light switch
AqaraAccessoryFactory.prototype.setLightSwitch = function (gatewaySid, deviceSid, uuidSeed, on, commander) {
  this.findServiceAndSetValue(
    gatewaySid,
    deviceSid,
    UUIDGen.generate(uuidSeed),
    this.config.fakeLightBulbForLightSwitch ? Accessory.Categories.LIGHTBULB : Accessory.Categories.SWITCH,
    this.config.fakeLightBulbForLightSwitch ? Service.Lightbulb : Service.Switch,
    Characteristic.On,
    on,
    commander);
}

// Plug
AqaraAccessoryFactory.prototype.setPlugSwitch = function (gatewaySid, deviceSid, uuidSeed, on, commander) {
  this.findServiceAndSetValue(
    gatewaySid,
    deviceSid,
    UUIDGen.generate(uuidSeed),
    Accessory.Categories.OUTLET,
    Service.Outlet,
    Characteristic.On,
    on,
    commander);
}

AqaraAccessoryFactory.prototype.getAccessoryModel = function (type) {
  switch (type) {
    case Service.Lightbulb:
      return "Light Switch";
    case Service.Outlet:
      return "Plug Switch";
    case Service.TemperatureSensor:
      return "Temperature Sensor";
    case Service.HumiditySensor:
      return "Humidity Sensor";
    case Service.ContactSensor:
    case Service.Door:
    case Service.Window:
      return "Contact Sensor";
    case Service.MotionSensor:
      return "Motion Sensor";
    default:
      return "Unknown";
  }
}

AqaraAccessoryFactory.prototype.findAccessoryByUUID = function (accessoryUUID) {
  for (var index in this.accessories) {
    if (this.accessories[index].UUID === accessoryUUID) {
      return this.accessories[index];
    }
  }
  return null;
}

AqaraAccessoryFactory.prototype.registerGatewayAccessory = function (platform, deviceSid) {
  var that = this;

  var accessoryName = deviceSid.substring(deviceSid.length - 4);
  var serviceName = accessoryName;

  var gatewaySid = deviceSid;
  var serviceName = accessoryName;
  var accessoryUUID = UUIDGen.generate(gatewaySid)
  var accessoryCategory = Accessory.Categories.LIGHTBULB;

  // Remember gateway/device update time
  this.lastGatewayUpdateTime[gatewaySid] = Date.now();
  this.lastDeviceUpdateTime[accessoryUUID] = Date.now();
  this.gatewaySids[accessoryUUID] = gatewaySid;

  var accessory = this.findAccessoryByUUID(accessoryUUID);

  if (accessory) {
    return true;
  };

  accessory = new PlatformAccessory(accessoryName, accessoryUUID, accessoryCategory)
  accessory.reachable = true;

  // Set serial number so we can track it later
  accessory.getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, "Aqara")
    .setCharacteristic(Characteristic.Model, "Lumi Gateway")
    .setCharacteristic(Characteristic.SerialNumber, deviceSid);

  var service = accessory.addService(Service.Lightbulb, serviceName);
  accessory.on('identify', function (pared, callback) {
    that.log.debug(accessory.displayName, 'Identify!!!');
    callback();
  });

  // add optional characteristic Hue & Brightness
  service.getCharacteristic(Characteristic.Brightness);
  service.getCharacteristic(Characteristic.Hue);

  this.registerGatewayCommander(platform, accessory);

  this.api.registerPlatformAccessories("homebridge-aqara", "AqaraPlatform", [accessory]);
  this.accessories.push(accessory);

  this.log.debug(util.format("Gateway accessory registered: %s", util.inspect(accessory, {
    depth: 4
  })));
}

AqaraAccessoryFactory.prototype.registerGatewayCommander = function (platform, gatewayAccessory) {
  var service = gatewayAccessory.getService(Service.Lightbulb);
  var deviceSid = gatewayAccessory.getService(Service.AccessoryInformation)
    .getCharacteristic(Characteristic.SerialNumber).value;

  // Register optional charateristic
  var hueCommander = new commander.LightHueCommander(platform, deviceSid, "gateway", gatewayAccessory);
  var briCommander = new commander.LightBrightnessCommander(platform, deviceSid, "gateway", gatewayAccessory);

  // service.getCharacteristic(Characteristic.Hue).on("set", function(value, callback){
  //     hueCommander.send(value);
  //     callback();
  // })

  service.getCharacteristic(Characteristic.Brightness).on("set", function (value, callback) {
    platform.log.debug(util.format("start adjust brightness to: %s", value));
    briCommander.send(value);
    callback();
  })

  service.getCharacteristic(Characteristic.On).on("set", function (value, callback) {
    briCommander.send(value ? 'on' : 'off');
    callback();
  })


}

AqaraAccessoryFactory.prototype.findServiceAndSetValue = function (
  gatewaySid, deviceSid,
  accessoryUUID, accessoryCategory,
  serviceType,
  characteristicType, characteristicValue,
  commander) {

  // Use last four characters of deviceSid as service name
  var accessoryName = deviceSid.substring(deviceSid.length - 4);
  if (this.sensorNames[accessoryName]) {
    var displayName = this.sensorNames[accessoryName];
    accessoryName = displayName;
  }
  var serviceName = accessoryName;

  // Remember gateway/device update time
  this.lastGatewayUpdateTime[gatewaySid] = Date.now();
  this.lastDeviceUpdateTime[accessoryUUID] = Date.now();
  this.gatewaySids[accessoryUUID] = gatewaySid;

  var that = this;
  var accessory = null;
  var service = null;

  accessory = this.findAccessoryByUUID(accessoryUUID);

  if (!accessory) {
    accessory = new PlatformAccessory(accessoryName, accessoryUUID, accessoryCategory);
    accessory.reachable = true;

    // Set serial number so we can track it later
    accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, "Aqara")
      .setCharacteristic(Characteristic.Model, this.getAccessoryModel(serviceType))
      .setCharacteristic(Characteristic.SerialNumber, deviceSid);

    service = accessory.addService(serviceType, serviceName);
    this.api.registerPlatformAccessories("homebridge-aqara", "AqaraPlatform", [accessory]);
    accessory.on('identify', function (paired, callback) {
      that.log.debug(accessory.displayName, "Identify!!!");
      callback();
    });

    this.accessories.push(accessory);
  } else {
    service = accessory.getService(serviceType);
  }

  if (!service) {
    service = accessory.addService(serviceType, serviceName);
  }

  var characteristic = service.getCharacteristic(characteristicType);
  if (characteristic) {
    that.log.debug("Set %s %s", serviceName, characteristicValue);
    characteristic.updateValue(characteristicValue);

    // Send command back once value is changed
    if (commander && (characteristic.listeners('set').length == 0)) {
      characteristic.on("set", function (value, callback) {
        commander.send(value);
        callback();
      });
    }
  } else {
    that.log.error(util.format("characteristic not found: %s", characteristicType));
  }
}
