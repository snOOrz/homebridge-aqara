const crypto = require('crypto');
const algorithm = 'aes-128-cbc';
const password = 'ojhd60q2xchzvi9k';
const iv = Buffer.from([0x17, 0x99, 0x6d, 0x09, 0x3d, 0x28, 0xdd, 0xb3, 0xba, 0x69, 0x5a, 0x2e, 0x6f, 0x58, 0x56, 0x2e]);
const token = 'pxbliBmIZ2ncfHsC';
const cipher = crypto.createCipheriv(algorithm, password, iv);
var encrypted = cipher.update(token, 'ascii', 'hex');
console.log(encrypted);
// encrypted += cipher.final('hex');
// console.log(encrypted);

const decipher = crypto.createDecipheriv(algorithm, password, iv);
decipher.setAutoPadding(false);
var decrypted = decipher.update(encrypted, 'hex', 'ascii');
decrypted += decipher.final('ascii');
console.log(decrypted);
