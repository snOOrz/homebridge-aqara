var fs = require("fs");
var path = require('path');

var parsersPath = path.resolve('../lib/parsers');
console.log(parsersPath);

fs.readdir(parsersPath,function(err,files){
    if(err){
        console.log(err);
        return;
    }
	var parsers = {};
    files.forEach(function(filename){
        var parserPath = path.join(parsersPath,filename);
		try {
			var parser = require(parserPath);
			var parserSupportModel = parser && parser.modelName;
			if (!parserSupportModel)	return;
			if (parserSupportModel instanceof Array) {
				parserSupportModel.forEach(function(model) {
					parsers[model] = parser;
				});
			} else {
				parsers[parserSupportModel] = parser;
			}
		} catch(error){}
    });
	console.dir(parsers);
});