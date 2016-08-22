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
  var platform = this;
  this.log = log;
  this.accessories = [];

  if (api) {
    // Save the API object as plugin needs to register new accessory via this object.
    this.api = api;

    this.api.on('didFinishLaunching', function() {
      // platform.log("DidFinishLaunching");
    }.bind(this));
  }
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

AquaraAccessoryFactory.prototype.setTemperatureAndHumidity = function(sensorID, temperature, humidity) {
  // Temperature
  this.findServiceAndSetValue(
    sensorID, // use sensorID as accessory name
    UUIDGen.generate('AuraraTemperature' + sensorID),
    Accessory.Categories.SENSOR,
    Service.TemperatureSensor,
    sensorID, // use sensorID as service name
    Characteristic.CurrentTemperature,
    temperature,
    null); // No commander

  // Humidity
  this.findServiceAndSetValue(
    sensorID, // use sensorID as accessory name
    UUIDGen.generate('AquaraHumidity' + sensorID),
    Accessory.Categories.SENSOR,
    Service.HumiditySensor,
    sensorID, // use sensorID as service name
    Characteristic.CurrentRelativeHumidity,
    humidity,
    null); // No commander
}

// Motion sensor
AquaraAccessoryFactory.prototype.setMotion = function(sensorID, motionDetected) {
  this.findServiceAndSetValue(
    sensorID, // use sensorID as accessory name
    UUIDGen.generate('AquaraMotion' + sensorID),
    Accessory.Categories.SENSOR,
    Service.MotionSensor,
    sensorID, // use sensorID as service name
    Characteristic.MotionDetected,
    motionDetected,
    null); // No commander
}

// Contact sensor
AquaraAccessoryFactory.prototype.setContact = function(sensorID, contacted) {
  this.findServiceAndSetValue(
    sensorID, // use sensorID as accessory name
    UUIDGen.generate('AquaraMagnet' + sensorID),
    Accessory.Categories.SENSOR,
    Service.ContactSensor,
    sensorID, // use sensorID as service name
    Characteristic.ContactSensorState,
    contacted ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED,
    null); // No commander
}

// Light switch
AquaraAccessoryFactory.prototype.setLightSwitch = function(sensorID, uuidSeed, on, commander) {
  this.findServiceAndSetValue(
    sensorID, // use sensorID as accessory name
    UUIDGen.generate(uuidSeed),
    Accessory.Categories.LIGHTBULB,
    Service.Lightbulb,
    sensorID, // use sensorID as service name
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
  }

  if (!service) {
    service = newAccessory.getService(serviceType);
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
