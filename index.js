var util = require('util');

function findNext(needle, haystack) {
	var ptr = 0;
	if (!Array.isArray(needle))
		needle = [needle];
	while (ptr < haystack.length) {
		if (needle.every((n, i) => haystack[ptr + i] === n))
			return ptr + needle.length;
		ptr += 1;
	}
	return -1;
}

function toArmaExponential(v) {
	var q = v.toString().split('.');
	if (q[1] && q[1].match(/^[0]{5}/)) {
		v = v.toExponential();
	}
	return v;
}

module.exports.cfg2json = function cfg2json(input) {
	var ptr = 0;
	var output = {};
	while (ptr < input.length) {
		var eol = findNext(['\r', '\n'], input.slice(ptr));
		if (eol === -1) break;
		var line = input.slice(ptr, ptr + eol).trim();
		if (classMatch = line.match(/^class\s+([a-z0-9]+)/i)) {
			ptr += findNext('{', input.slice(ptr)) + 1;
			var innerStart = ptr;
			var parenthesisCount = 1;
			while (parenthesisCount > 0) {
				var c = input[ptr];
				if (c === '"' || c === '\'') {
					ptr += 1;
					var closeString = findNext(c, input.slice(ptr));
					ptr += closeString + 1;
				} else if (c === '{') {
					parenthesisCount += 1;
				} else if (c === '}') {
					parenthesisCount -= 1;
				}
				ptr += 1;
			};
			var inner = input.slice(innerStart, ptr - 1).trim() + '\r\n';
			output[classMatch[1]] = cfg2json(inner);
			eol = findNext(['\r', '\n'], input.slice(ptr));
		} else if (varStringMatch = line.match(/^([a-z0-9]+)="(.+)";$/i)) {
			output[varStringMatch[1]] = varStringMatch[2];
		} else if (varNumberMatch = line.match(/^([a-z0-9]+)=([0-9\.\-e]+);$/i)) {
			output[varNumberMatch[1]] = parseFloat(varNumberMatch[2]);
		} else if (arrMatch = line.match(/^([a-z0-9]+)\[\]=/i)) {
			ptr += findNext('{', input.slice(ptr)) + 1;
			var innerStart = ptr - 1;
			var parenthesisCount = 1;
			while (parenthesisCount > 0) {
				var c = input[ptr];
				if (c === '"' || c === '\'') {
					ptr += 1;
					var closeString = findNext(c, input.slice(ptr));
					ptr += closeString + 1;
				} else if (c === '{') {
					parenthesisCount += 1;
				} else if (c === '}') {
					parenthesisCount -= 1;
				}
				ptr += 1;
			};
			var inner = '[' + input.slice(innerStart, ptr - 1).trim() + ']';
			output[arrMatch[1]] = JSON.parse(inner);
			eol = findNext(['\r', '\n'], input.slice(ptr));
		}
		ptr += eol;
	}
	return output;
};

module.exports.json2cfg = function json2cfg(input, indent) {
	indent = indent || 0;
	var tabs = '\t'.repeat(indent);
	var output = [];
	Object.keys(input).forEach(function (key) {
		var val = input[key];
		var type = typeof val;
		if (type === 'object' && Array.isArray(val))
			type = 'array';
		switch (type) {
			case 'string':
				output.push(util.format('%s%s="%s";', tabs, key, val));
			break;
			case 'number':
				if (key === 'atlOffset')
					val = toArmaExponential(val);
				output.push(util.format('%s%s=%s;', tabs, key, val));
			break;
			case 'array':
				if (val.some(v => typeof v === 'string')) {
					output.push(util.format('%s%s[]=', tabs, key));
					output.push(util.format('%s{', tabs));
					val.forEach(function (v, i, a) {
						if (isNaN(v))
							output.push(util.format('%s"%s"%s', tabs + '\t', v, (i === a.length - 1) ? '' : ','));
						else
							output.push(util.format('%s%s%s', tabs + '\t', v, (i === a.length - 1) ? '' : ','));
					});
					output.push(util.format('%s};', tabs));
				} else {
					var line = '';
					val.forEach((v, i) => {
						v = toArmaExponential(v);
						line += v + ((i === val.length-1) ? '' : ',');
					});
					output.push(util.format('%s%s[]={%s};', tabs, key, line));
				}
			break;
			case 'object':
				var inner = json2cfg(val, indent+1);
				output.push(util.format('%sclass %s', tabs, key));
				output.push(util.format('%s{', tabs));
				output = output.concat(inner);
				output.push(util.format('%s};', tabs));
			break;
		}
	});
	return (indent === 0) ? output.join('\r\n') + '\r\n' : output;
};