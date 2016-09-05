const crypto = require('crypto');
const password = ['0987654321qwerty', 'abcdefghABCDEFGH'];
const iv = Buffer.from([0x17, 0x99, 0x6d, 0x09, 0x3d, 0x28, 0xdd, 0xb3, 0xba, 0x69, 0x5a, 0x2e, 0x6f, 0x58, 0x56, 0x2e]);
const token = '1234567890abcdef';
for (var index in password) {
  const cipher = crypto.createCipheriv('aes-128-cbc', password[index], iv);
  console.log(cipher.update(token, 'utf8', 'hex'));
}
