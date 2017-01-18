# homebridge-aqara
[![npm version](https://badge.fury.io/js/homebridge-aqara.svg)](https://badge.fury.io/js/homebridge-aqara)

Aqara plugin for [HomeBridge](https://github.com/nfarina/homebridge)

This repository contains the Aqara plugin for homebridge.

Aqara is a ZigBee gateway with a few sensors. Please see the pictures below.

![](http://i1.mifile.cn/a1/T19eL_Bvhv1RXrhCrK!200x200.jpg)
![](http://i1.mifile.cn/a1/T1bFJ_B4Jv1RXrhCrK!200x200.jpg)
![](http://i1.mifile.cn/a1/T1zXZgBQLT1RXrhCrK!200x200.jpg)
![](http://i1.mifile.cn/a1/T1xKYgBQhv1R4cSCrK!200x200.png)
![](http://i1.mifile.cn/a1/T1kZd_BbLv1RXrhCrK!200x200.jpg)

### Pre-Requirements
1. Make sure you have V2 of the gateway. V1 has limited space so can't support this feature.
2. Update gateway firmware to 1.4.1_141.0141 or later. You can contact [@babymoney666](https://github.com/babymoney666) if your firmware is not up to date.

### Installation
1. Install HomeBridge, please follow it's [README](https://github.com/nfarina/homebridge/blob/master/README.md). If you are using Raspberry Pi, please read [Running-HomeBridge-on-a-Raspberry-Pi](https://github.com/nfarina/homebridge/wiki/Running-HomeBridge-on-a-Raspberry-Pi).
2. Make sure you can see HomeBridge in your iOS devices, if not, please go back to step 1.
3. Download homebridge-aqara to your local folder.

### Configuration
1. Open Aqara gateway's settings, enable [local network protocol](https://github.com/louisZL/lumi-gateway-local-api). Please follow the steps in this thread: http://bbs.xiaomi.cn/t-13198850. It's in Chinese so you might need a translator to read it.
2. To control the devices, put gateway's MAC address (lower case without colon) and password to ~/homebridge/config.json.


        {
            "platforms": [
            {
                "platform": "AqaraPlatform",
                "sid": ["6409802da3b3"],
                "password": ["02i44k56zrgg578b"]
            }]
        }

 If you have more than one gateways, fill them in right order, like below.


        {
            "platforms": [
            {
                "platform": "AqaraPlatform",
                "sid": ["6409802da3b3", "f0b4299a5b2b", "f0b4299a77dd"],
                "password": ["02i44k56zrgg578b", "g250s2vtne8q9qhv", "syu3oasva3uqd5qd"]
            }]
        }

 If gateway's password is not set or not set right, you will see the following error in homebridge's output.


        > No password for gateway f0b429cbe4d3, please edit ~/.homebridge/config.json

 If you like to use Light Bulb type for Light Switch to make grandma Siri happy, like me, you can set the following in the config.


        {
            "platforms": [
            {
                "platform": "AqaraPlatform",
                ...
                "fakeLightBulbForLightSwitch": true,
                ...
            }]
        }

### Run it
1. From source code


        $ cd /path/to/homebridge-aqara
        $ DEBUG=* homebridge -D -P .

2. As homebridge plugin


        $ npm install -g homebridge-aqara
        $ homebridge
