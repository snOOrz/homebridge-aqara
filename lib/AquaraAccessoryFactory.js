var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen, Factory;

module.exports = function(homebridge) {
  Accessory = homebridge.hap.Accessory;
  PlatformAccessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  return AquaraAccessoryFactory;
}

function AquaraAccessoryFactory(log, api) {
  this.log = log;
  this.accessories = [];
}

// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
AquaraAccessoryFactory.prototype.configureAccessory = function(accessory) {
  // this.log(accessory.displayName, "Configure Accessory");
  var platform = this;

  // set the accessory to reachable if plugin can currently process the accessory
  // otherwise set to false and update the reachability later by invoking
  // accessory.updateReachability()
  accessory.reachable = true;
  accessory.on('identify', function(paired, callback) {
    platform.log(accessory.displayName, "Identify!!!");
    callback();
  });

  this.accessories.push(accessory);
}

AquaraAccessoryFactory.prototype.setTemperatureAndHumidity = function(deviceSid, temperature, humidity) {
  // use last four characters of deviceSid as service name
  var deviceName = deviceSid.substring(deviceSid.length - 4);

  // Temperature
  this.findServiceAndSetValue(
    deviceName,
    UUIDGen.generate('Tem' + deviceSid),
    Accessory.Categories.SENSOR,
    Service.TemperatureSensor,
    deviceName,
    Characteristic.CurrentTemperature,
    temperature,
    null); // No commander

  // Humidity
  this.findServiceAndSetValue(
    deviceName,
    UUIDGen.generate('Hum' + deviceSid),
    Accessory.Categories.SENSOR,
    Service.HumiditySensor,
    deviceName,
    Characteristic.CurrentRelativeHumidity,
    humidity,
    null); // No commander
}

// Motion sensor
AquaraAccessoryFactory.prototype.setMotion = function(deviceSid, motionDetected) {
  // use last four characters of deviceSid as service name
  var deviceName = deviceSid.substring(deviceSid.length - 4);

  this.findServiceAndSetValue(
    deviceName, // use deviceSid as accessory name
    UUIDGen.generate('Mot' + deviceSid),
    Accessory.Categories.SENSOR,
    Service.MotionSensor,
    deviceName, // use deviceSid as service name
    Characteristic.MotionDetected,
    motionDetected,
    null); // No commander
}

// Contact sensor
AquaraAccessoryFactory.prototype.setContact = function(deviceSid, contacted) {
  // use last four characters of deviceSid as service name
  var deviceName = deviceSid.substring(deviceSid.length - 4);

  this.findServiceAndSetValue(
    deviceName,
    UUIDGen.generate('Mag' + deviceSid),
    Accessory.Categories.SENSOR,
    Service.ContactSensor,
    deviceName,
    Characteristic.ContactSensorState,
    contacted ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED,
    null); // No commander
}

// Light switch
AquaraAccessoryFactory.prototype.setLightSwitch = function(deviceSid, uuidSeed, on, commander) {
  // use last four characters of deviceSid as service name
  var deviceName = deviceSid.substring(deviceSid.length - 4);

  this.findServiceAndSetValue(
    deviceName,
    UUIDGen.generate(uuidSeed),
    Accessory.Categories.LIGHTBULB,
    Service.Lightbulb,
    deviceName,
    Characteristic.On,
    on,
    commander);
}

AquaraAccessoryFactory.prototype.findServiceAndSetValue = function(
  accessoryName, accessoryUUID, accessoryCategory,
  serviceType, serviceName,
  characteristicType, characteristicValue,
  commander) {

  var platform = this;
  var newAccessory = null;
  var service = null;

  for (var index in this.accessories) {
    var accessory = this.accessories[index];
    if (accessory.UUID === accessoryUUID) {
      newAccessory = accessory;
    }
  }

  if (!newAccessory) {
    newAccessory = new PlatformAccessory(accessoryName, accessoryUUID, accessoryCategory);
    service = newAccessory.addService(serviceType, serviceName);
    this.api.registerPlatformAccessories("homebridge-aquara", "AquaraPlatform", [newAccessory]);
    newAccessory.on('identify', function(paired, callback) {
      platform.log(accessory.displayName, "Identify!!!");
      callback();
    });

    this.accessories.push(newAccessory);
  } else {
    service = newAccessory.getService(serviceType);
  }

  if (!service) {
    service = newAccessory.addService(serviceType, serviceName);
  }

  var characteristic = service.getCharacteristic(characteristicType);

  if (characteristic) {
    // platform.log("Set %s %s", serviceName, characteristicValue);
    characteristic.setValue(characteristicValue);

   // Send command back once value is changed
   if (commander && (characteristic.listeners('set').length == 0)) {
     characteristic.on("set", function(value, callback) {
       commander.send(value);
       callback();
     });
   }
  } else {
    platform.log("Service not found");
  }
}
