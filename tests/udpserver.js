const dgram = require('dgram');
const serverPort = 9898;
const serverSocket = dgram.createSocket('udp4');
const multicastAddress = '224.0.0.50';
const multicastPort = 4321;
var sidToAddress = {};
var sidToPort = {};

serverSocket.on('message', function(msg, rinfo){
  var json;
  try {
      json = JSON.parse(msg);
  } catch (e) {
    console.log('Unexpected message: %s', msg);
    return;
  }

  var cmd = json['cmd'];
  if (cmd === 'iam') {
    var address = json['ip'];
    var port = json['port'];
    var cmd = '{"cmd":"get_id_list"}';
    console.log('Step 3. Send %s to %s:%d', cmd, address, port);
    serverSocket.send(cmd, 0, cmd.length, port, address);
  } else if (cmd === 'get_id_list_ack') {
    var data = JSON.parse(json['data']);
    for(var index in data) {
      var sid = data[index];
      var response = '{"cmd":"read", "sid":"' + sid + '"}';
      // Remember this sid's address
      sidToAddress[sid] = rinfo.address;
      sidToPort[sid] = rinfo.port;

      console.log('Step 4. Send %s to %s:%d', response, rinfo.address, rinfo.port);
      serverSocket.send(response, 0, response.length, rinfo.port, rinfo.address);
    }
  } else if (cmd === 'read_ack') {
    var model = json['model'];
    var data = JSON.parse(json['data']);
    if (model === 'sensor_ht') {
      var temperature = data['temperature'] ? data['temperature'] / 100.0 : 100;
      var humidity = data['humidity'] ? data['humidity'] / 100.0 : 0;
      console.log("Step 5. Got temperature/humidity sensor:%s's data: temperature %d, humidity %d", json['sid'], temperature, humidity);
    } else if (model === 'motion') {
      console.log("Step 5. Got motion sensor:%s's data: move %s", json['sid'], (data['status'] === 'motion') ? 'detected' : 'not detected');
    } else if (model === 'magnet') {
      console.log("Step 5. Got contact/magnet sensor:%s's data: contact %s", json['sid'], (data['status'] === 'close') ? 'detected' : 'not detected');
    } else if (model === 'ctrl_neutral1') {
      console.log("Step 5. Got light switch:%s's data: %s", json['sid'], data['channel_0']);
    } else if (model === 'ctrl_neutral2') {
      console.log("Step 5. Got duplex light switch:%s's data: left %s, right %s", json['sid'], data['channel_0'], data['channel_1']);
    } else {
      console.log("Step 5. Got %s:%s's data:%s", json['model'], json['sid'], json['data']);
    }
  } else if (cmd === 'report') {
    var model = json['model'];
    var data = JSON.parse(json['data']);
    if (model === 'sensor_ht') {
      var temperature = data['temperature'] ? data['temperature'] / 100.0 : 100;
      var humidity = data['humidity'] ? data['humidity'] / 100.0 : 0;
      console.log("Step 6. Got temperature/humidity sensor:%s's report: temperature %d, humidity %d", json['sid'], temperature, humidity);
    } else if (model === 'motion') {
      console.log("Step 6. Got motion sensor:%s's report: move %s", json['sid'], (data['status'] === 'motion') ? 'detected' : 'not detected');
    } else if (model === 'magnet') {
      console.log("Step 6. Got contact/magnet sensor:%s's report: contact %s", json['sid'], (data['status'] === 'close') ? 'detected' : 'not detected');
    } else if (model === 'ctrl_neutral1') {
      console.log("Step 6. Got light switch:%s's report: %s", json['sid'], data['channel_0']);
    } else if (model === 'ctrl_neutral2') {
      console.log("Step 6. Got duplex light switch:%s's report: left %s, right %s", json['sid'], data['channel_0'], data['channel_1']);
    } else {
      console.log("Step 6. Got %s:%s's report:%s", json['model'], json['sid'], json['data']);
    }
  } else if (cmd === 'heartbeat') {
    var model = json['model'];
    var data = JSON.parse(json['data']);
    if (model === 'sensor_ht') {
      var temperature = data['temperature'] ? data['temperature'] / 100.0 : 100;
      var humidity = data['humidity'] ? data['humidity'] / 100.0 : 0;
      console.log("Step 7. Got temperature/humidity sensor:%s's heartbeat: temperature %d, humidity %d", json['sid'], temperature, humidity);
    } else if (model === 'motion') {
      console.log("Step 7. Got motion sensor:%s's heartbeat: move %s", json['sid'], (data['status'] === 'motion') ? 'detected' : 'not detected');
    } else if (model === 'magnet') {
      console.log("Step 7. Got contact/magnet sensor:%s's heartbeat: contact %s", json['sid'], (data['status'] === 'close') ? 'detected' : 'not detected');
    } else if (model === 'ctrl_neutral1') {
      console.log("Step 7. Got light switch:%s's heartbeat: %s", json['sid'], data['channel_0']);
    } else if (model === 'ctrl_neutral2') {
      console.log("Step 7. Got duplex light switch:%s's heartbeat: left %s, right %s", json['sid'], data['channel_0'], data['channel_1']);
    } else if (model === 'gateway') {
      console.log("Step 7. Got gateway:%s's heartbeat:%s with token:%s", json['sid'], json['data'], json['token']);
    } else {
      console.log("Step 7. Got %s:%s's heartbeat:%s", json['model'], json['sid'], json['data']);
    }
  } else if (cmd === 'write') {
    // Commands from udpclient.js, pass them to gateway
    var sid = json['sid'];
    if (!sid || !sidToPort[sid] || !sidToAddress[sid]) {
      console.log('Invalid or unknown sid in %s', msg);
    } else {
      serverSocket.send(msg, 0, msg.length, sidToPort[sid], sidToAddress[sid]);
    }
  } else {
    console.log('recv %s(%d bytes) from client %s:%d\n', msg, msg.length, rinfo.address, rinfo.port);
  }
});

//    err - Error object, https://nodejs.org/api/errors.html
serverSocket.on('error', function(err){
  console.log('error, msg - %s, stack - %s\n', err.message, err.stack);
});

serverSocket.on('listening', function(){
  console.log('Step 1. Start a UDP server, listening on port %d.', serverPort);
  serverSocket.addMembership(multicastAddress);
})

console.log('Demo server, in the following steps:');

serverSocket.bind(serverPort);

function sendWhois() {
  var cmd = '{"cmd": "whois"}';
  serverSocket.send(cmd, 0, cmd.length, multicastPort, multicastAddress);
  console.log('Step 2. Send %s to a multicast address %s:%d.', cmd, multicastAddress, multicastPort);
}

sendWhois();

setInterval(function() {
  console.log('Step 2. Start another round.');
  sendWhois();
}, 30000);
