var dgram = require('dgram');
var readline = require('readline');
var socket = dgram.createSocket('udp4');
var command = '{"cmd" : "queryTemperture"}';

socket.on('message', function(msg, rinfo){
  console.log('recv %s(%d bytes) from client %s:%d\n', msg, msg.length, rinfo.address, rinfo.port);
});

//    err - Error object, https://nodejs.org/api/errors.html
socket.on('error', function(err){
	console.log('error, msg - %s, stack - %s\n', err.message, err.stack);
});

socket.on('listening', function(){
  console.log("Demo client is listening.");
})

socket.bind();
readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
}).on('line', function(line){
    console.log('Sending %s to demo server', line);
    socket.send(line, 0, line.length, 9898, 'localhost');
});

// nodejs udpclient.js
// type commands in stdin
// sample commands
// {"cmd":"write","model":" ctrl_neutral2","sid":"158d0000f865d8","token":"8","data":"{\"channel_0\":\"on\"}" }
// {"cmd":"write","model":" ctrl_neutral2","sid":"158d0000f865d8","token":"8","data":"{\"channel_0\":\"off\"}" }
