const crypto = require('crypto');

// http://stackoverflow.com/a/25951500/66673
function generate(data) {
  var sha1sum = crypto.createHash('sha1');
  sha1sum.update(data);
  var s = sha1sum.digest('hex');
  var i = -1;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    i += 1;
    switch (c) {
      case 'x':
        return s[i];
      case 'y':
        return ((parseInt('0x' + s[i], 16) & 0x3) | 0x8).toString(16);
    }
  });
}

console.log(generate("Mot158d0001010081"));
