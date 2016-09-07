# homebridge-aquara
Aquara plugin for [HomeBridge](https://github.com/nfarina/homebridge)

This repository contains the Aquara plugin for homebridge.

Aquara is a ZigBee gateway with a few sensors. Please see the pictures below.

![](http://i1.mifile.cn/a1/T19eL_Bvhv1RXrhCrK!200x200.jpg)
![](http://i1.mifile.cn/a1/T1bFJ_B4Jv1RXrhCrK!200x200.jpg)
![](http://i1.mifile.cn/a1/T1zXZgBQLT1RXrhCrK!200x200.jpg)
![](http://i1.mifile.cn/a1/T1xKYgBQhv1R4cSCrK!200x200.png)


### Installation
1. Install HomeBridge, please follow it's [README](https://github.com/nfarina/homebridge/blob/master/README.md). If you are using Raspberry Pi, please read [Running-HomeBridge-on-a-Raspberry-Pi](https://github.com/nfarina/homebridge/wiki/Running-HomeBridge-on-a-Raspberry-Pi).
2. Make sure you can see HomeBridge in your iOS devices, if not, please go back to step 1.
3. Download homebridge-aquara to your local folder.

### Configuration
1. Open Aquara gateway's settings, enable local network protocol.
2. Put gateway's MAC address (lower case without colon) and password to ~/homebridge/config.json. If you have more than one gateways, fill them in right order, like below.


        {
            "platforms": [
            {
                "platform": "AquaraPlatform",
                "sid": ["6409802da3b3", "f0b4299a5b2b", "f0b4299a77dd"],
                "password": ["02i44k56zrgg578b", "g250s2vtne8q9qhv", "syu3oasva3uqd5qd"]
            }]
        }

### Run it
1. From source code


        $ cd /path/to/homebridge-aquara
        $ DEBUG=* homebridge -D -P .

2. As homebridge plugin


        $ npm install -g homebridge-aquara
        $ homebridge
