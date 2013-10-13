// The MIT License (MIT)
//
// NestedJS (c) 2013 Emanuele Spatola - emanuele.spatola@gmail.com
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

var NJS = {
	addWatcher: function (obj, watcher, prop, sup, recursive) {	
		if (obj.split){
			var lioDot = obj.lastIndexOf(".");
			var lioBracket = obj.lastIndexOf("[");
			if (lioDot > lioBracket) {
				sup = eval(obj.substring(0, lioDot));
				prop = obj.substring(lioDot+1);
				console.log("NJS.addWatcher: "+obj.substring(0, lioDot)+" -> "+prop);
			} else if (lioBracket > lioDot) {
				sup = eval(obj.substring(0, lioBracket));
				prop = obj.substring(lioBracket+1,obj.length-1);
				console.log("NJS.addWatcher: "+obj.substring(0, lioBracket)+" -> "+prop);
			}
			//if I'm trying to add a watcher for the length of a string, I add the watchers for the entire string since is not possible to add the watchers array to a string object
			if (sup !== undefined && typeof sup == 'string') {
				NJS.addWatcher(obj.substring(0, lioDot),watcher);
				return;
			}
			
			if(sup === undefined){ 
				sup = window;
				prop = obj;
			}
			
			try{
				obj = eval(obj);
			} catch(e){}
		}
		
		if (obj instanceof Array){
			NJS.overrideMethods(obj, watcher);
		} else if (sup !== undefined && prop!='length'){// && sup.watchers == null){ //TODO: double-check: sup.watchers == null
			NJS.defineGetSet(sup, prop);
		}
		
		
		//TODO: make the watchers property not enumerable
		if (!obj.watchers) {
			obj.watchers = [];
		}
		if (obj.watchers) {
			obj.watchers.push(watcher);
		}

		if ((sup !== undefined) && !(sup instanceof Array)) {
			if (!sup.watchers) {
				sup.watchers = [];
			}
			if (!sup.watchers[prop]) {
				sup.watchers[prop] = [];
			}
			if (sup.watchers[prop]) {
				sup.watchers[prop].push(watcher);
			}
		}
		
		if (prop=='length'){
			if (!sup.watchers) {
				sup.watchers = [];
			}
			var oldwatcher = watcher;
			watcher = function(obj, prop, newval, oldval) {
				oldwatcher("","",obj.length,"");
			}
			sup.watchers.push(watcher);
		}
		
		//if(obj instanceof Array) { // || obj instanceof Object
			//for (var i=0;i<obj.length;i++) {
				////if (!NJS.isFunction(obj[i]))
					//NJS.addWatcher(obj[i], watcher, i, obj);
			//}
		//}
		
		//TODO: double-check!
		recursive = recursive || true;
		if (recursive){
			try{
				if(obj instanceof Array || obj instanceof Object){
					for (prop in obj){
						if (prop != 'watchers' && obj[prop] != undefined)
							NJS.addWatcher(obj[prop], watcher, prop, obj);
					}
				}
			} catch(e){
				console.warn(e, obj, prop, sup);
			}
		}
	},


	isFunction: function (functionToCheck) {
		var getType = {};
		return functionToCheck && getType.toString.call(functionToCheck) == '[object Function]';
	},


	refreshWatchers: function(obj) {
			var tmpWatchers = obj.watchers.slice(0);
			obj.watchers = [];
			for (var i=0;i<tmpWatchers.length;i++){
				NJS.addWatcher(obj, tmpWatchers[i]);
			}
	},


	overrideMethods: function(obj){
		//TODO: make all this functions not enumerable (also the getter and setter)
		obj.push = function (){
			var ret = Array.prototype.push.apply(this,arguments);
			NJS.refreshWatchers(obj);
			//NJS.callWatchers(obj,obj.length-1,obj.toString());
			NJS.callWatchers(obj,[obj.length-1,0,1],obj.toString());
			return ret;
		};
		
		obj.pop = function (){
			var ret = Array.prototype.pop.apply(this,arguments);
			//NJS.callWatchers(obj,"",obj.toString());
			NJS.callWatchers(obj,[obj.length-1,1,0],obj.toString());
			return ret;
		};
		
		obj.concat = function (){
			var ret = Array.prototype.concat.apply(this,arguments);
			NJS.refreshWatchers(obj);
			NJS.callWatchers(obj,"",obj.toString());
			return ret;
		};
		
		obj.shift = function (){
			var ret = Array.prototype.shift.apply(this,arguments);
			NJS.refreshWatchers(obj);
			NJS.callWatchers(obj,"",obj.toString());
			return ret;
		};
		
		obj.splice = function (){
			if (obj.watchers!=null){
				var watchers = obj.watchers.slice(0);
			} else {
				var watchers = [];
			}
			obj.watchers = [];
			var ret = Array.prototype.splice.apply(this,arguments);
			obj.watchers = watchers;
			NJS.refreshWatchers(obj);
			//NJS.callWatchers(obj,"",obj.toString());
			NJS.callWatchers(obj,arguments,obj.toString());
			return ret;
		};
		
		obj.unshift = function (){
			var ret = Array.prototype.unshift.apply(this,arguments);
			NJS.refreshWatchers(obj);
			NJS.callWatchers(obj,"",obj.toString());
			return ret;
		};
		
		obj.sort = function (){
			if (obj.watchers!=null){
				var watchers = obj.watchers.slice(0);
			} else {
				var watchers = [];
			}
			obj.watchers = [];
			var ret = Array.prototype.sort.apply(this,arguments);
			for (wr=0;wr<watchers.length;wr++){
				NJS.addWatcher(obj, watchers[wr]);
			}
			NJS.callWatchers(obj,"",obj.toString());
			return ret;
		};
	},


	defineGetSet: function (obj, prop) {
		if (!NJS.isFunction(obj[prop])){
			var val = obj[prop];
			
			//if I already have a getter, I use it, otherwise I have to create one
			if (obj[prop].get){
				var get = obj[prop].get;
			} else {
				var get = function(){
					return val;
				};
			}
			
			//if I already have a setter, I include it in the new one
			if (obj[prop].set){
				var oldSet = obj[prop].set;
				var set = function(newval) {
					oldval = val;
					oldSet(newval);
					NJS.callWatchers(obj, prop, newval, oldval);
				};
			} else {
				var set = function(newval) {
					oldval = val;
					val = newval;
					NJS.callWatchers(obj, prop, newval, oldval);
				};
			}
			
			if (Object.defineProperty) {
				Object.defineProperty(obj, prop, {
									  get: get,
									  set: set
									  });
			} else {
				Object.prototype.__defineGetter__.call(obj, prop, get);
				Object.prototype.__defineSetter__.call(obj, prop, set);
			}
		}
	},


	callWatchers: function (obj, prop, newval, oldval) {
		if (newval != oldval){
			if (obj instanceof Array)
				wrs = obj.watchers;
			else
				wrs = obj.watchers[prop]
			for (var wr=0;wr<wrs.length;wr++) {
				try {
					wrs[wr].call(obj[prop], obj, prop, newval, oldval); //TODO: primo argomento: obj[prop] se prop contiene il range che succede?
				} catch (ex){ // quando l'indice di un elemento nell'array cambia, rimangono dei watcher che si riferiscono all'elemento con il vecchio indice, creado degli errori. inoltre ogni volta che l'elemento cambia indice gli viene aggiunto un watcher, e a lungo andare questo array diventa enorme, quindi non appena un watcher da errore lo elimino
					wrs.splice(wr,1);
					console.log('old binding removed');
				}
			}
		}
	},


	getStyle: function(el, cssprop){ //TODO: fix this, it doesn't get the real css
		if (el.currentStyle) //IE
			return el.currentStyle[cssprop];
		else if (document.defaultView && document.defaultView.getComputedStyle) //Firefox
			return document.defaultView.getComputedStyle(el, "")[cssprop];
		else //try and get inline style
			return el.style[cssprop];
	},	


	isEvent: function (elem, eventName){
		var el = document.createElement(elem.tagName);
		eventName = 'on' + eventName;
		var isSupported = (eventName in el);
		if (!isSupported) {
			el.setAttribute(eventName, 'return;');
			isSupported = typeof el[eventName] == 'function';
		}
		el = null;
		return isSupported;
	},


	isNoRepeat: function (elem) {
		if (elem.getAttribute) {
			if (elem.getAttribute('no-repeat')!=null) {
				return true;
			}
		}
		return false;
	},


	createRegExp: function (exp){
		if (exp.constructor.name == "RegExp")
			return exp;
		if (exp.lastIndexOf) {
			var modifier = exp.lastIndexOf('/');
			if (modifier>=0){
				if (modifier==0 || exp.charAt(modifier-1) != '\\'){
					return new RegExp(exp.substring(0,modifier), exp.substring(modifier+1));
				}
			}
		}
		return new RegExp(exp, "im");
	},


	removeStrings: function (str, removedStrings) {
		var start=0;
		var end=0;
		while(str.indexOf("'")>=0) {
			start = str.indexOf("'");
			end = str.indexOf("'",start+1);
			removedStrings.push(str.substring(start,end+1));
			str = str.replace(removedStrings[removedStrings.length-1],"_-_"+(removedStrings.length-1))
		}
		return str;
	},


	insertStrings: function (str, removedStrings) {
		for (var i=0;i<removedStrings.length;i++){
			str = str.replace("_-_"+i, removedStrings[i]);
		}
		return str;
	},


	isValidVaribleName: function (varName){
		// ES5.1 / Unicode 6.1 thanks Mathias Bynens
		//var invalid = /^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[$A-Z\_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc][$A-Z\_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc0-9\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u0669\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u06f0-\u06f9\u0711\u0730-\u074a\u07a6-\u07b0\u07c0-\u07c9\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09cb-\u09cd\u09d7\u09e2\u09e3\u09e6-\u09ef\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e50-\u0e59\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e\u0f3f\u0f71-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1040-\u1049\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4-\u17d3\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u18a9\u1920-\u192b\u1930-\u193b\u1946-\u194f\u19b0-\u19c0\u19c8\u19c9\u19d0-\u19d9\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b00-\u1b04\u1b34-\u1b44\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1bb0-\u1bb9\u1be6-\u1bf3\u1c24-\u1c37\u1c40-\u1c49\u1c50-\u1c59\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf2-\u1cf4\u1dc0-\u1de6\u1dfc-\u1dff\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua620-\ua629\ua66f\ua674-\ua67d\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua880\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f1\ua900-\ua909\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9d0-\ua9d9\uaa29-\uaa36\uaa43\uaa4c\uaa4d\uaa50-\uaa59\uaa7b\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaeb-\uaaef\uaaf5\uaaf6\uabe3-\uabea\uabec\uabed\uabf0-\uabf9\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f]*$/;
		// altrimenti:
		if (varName == '$data' || varName == '$index') return false;
		var invalid = /^[a-zA-Z_$][0-9a-zA-Z-_$]*$/
		return invalid.test(varName);
	},


	getNewPath: function (path,elem){
		if (elem.getAttribute){
			obj = elem.getAttribute('bind');
			if (obj!=null){
				try {
					// if the object is a Class I return the name of the class as a path 
					if(eval('('+path+obj+' instanceof Object) && !('+path+obj+' instanceof Array)'))
						return path+obj+'.';
				} catch(e) {return path;}
			}
		}
		return path;
	},
		

	createMissingProp: function (elem, path) {
		var dubug = path;
		for (child in elem.childNodes){
			isArray = false;
			if (elem.childNodes[child].getAttribute){
				var bind_string = elem.childNodes[child].getAttribute('bind');
				if (bind_string!=null){
					var removedStrings = [];
					bind_string = NJS.removeStrings(bind_string, removedStrings);
					bsplit = NJS.splitBindings(bind_string);
					for (b=0;b<bsplit.length;b++) {
						try{
						   if(eval(path+bsplit[b].trim()+' instanceof Array')){
							   isArray = true;
							   continue;
						   }
						}catch(e){};
						if (bsplit[b].indexOf(":")>0){
							var prop = bsplit[b].split(":")[1].trim();
						}else{
							var prop = bsplit[b].trim();
						}					
						if (NJS.isValidVaribleName(prop)){
							var pathArray = path.split(".");
							pathArray.pop();
							pathArray.splice(0,0,'window'); //crea problemi di omonimia perchè window contiene parecchie property, in più le properti di windows non possono essere osservate
							var p=pathArray.length+1;
							var found = false;
							while(p>0 && !found){
								var tmpPath = pathArray.slice(0,p).join(".")
								try{
									if (eval(tmpPath+'.'+prop) !== undefined)
										found = true;
								} catch(e){
									console.log(e);
								}
								p--;
							}
							if (!found) {
								NJS.addProperty(path+prop);
							}
						}
					}
				}
			}
			if (!isArray)
				NJS.createMissingProp(elem.childNodes[child],NJS.getNewPath(path,elem.childNodes[child]))
		}
	},


	getProp: function (obj) {
		var lioDot = obj.lastIndexOf(".");
		var lioBracket = obj.lastIndexOf("[");
		if (lioDot > lioBracket) {
			sup = obj.substring(0, lioDot);
			prop = obj.substring(lioDot+1);
		} else if (lioBracket > lioDot) {
			sup = obj.substring(0, lioBracket);
			prop = obj.substring(lioBracket+1,obj.length-1);
		}
		return {sup: sup, prop: prop};
	},


	addProperty: function (completePath) {
		console.log('====>'+completePath+': property created')
		var value, obj;
		if (completePath.split('.').length > 1){
			obj = NJS.getProp(completePath);
			eval(obj.sup+'.'+obj.prop+'=""');
		} else {
			eval(completePath+'=new function(){}');
		}
	},


	setProp: function (elem, prop, value){
		try {
			if (elem[prop] != null){
				if (elem[prop] != value)  // evita di settare il valore nella texbox in cui stai scrivendo
					elem[prop] = value;
			} else {
				elem.setAttribute(prop, value);
			}
		} catch(e){
			console.log('cannot set the property '+prop+' of '+elem.toString())
		}
	},


	getValue: function (elem, prop, obj){
		if (typeof elem[prop] == "string") {
			eval(obj+' = "'+elem[prop]+'"');
		} else {
			eval(obj+' = '+elem[prop]);
		}
	},


	bindTo: function (elem, prop, path, obj){
		try {
			try {
				// is the object is a Class I do not bind it to the element and return the name of the class as a path 
				if(eval('('+path+obj+') instanceof Object && !(('+path+obj+') instanceof Array)'))
					return path+obj;
			} catch(e) {}
			var props = [];
			var tagName;
			var complete = NJS.getPath(obj, path, props);
			var continueBindings = true;
			if (NJS.isEvent(elem,prop)){
				elem.addListener(prop, function(e) {
					eval(complete);
					e.preventDefault();
				});
			} else {
				if (eval('('+complete+') instanceof Array')==true) {
					NJS.repeatBinding(elem, path, obj, eval(complete));
					for(var j=0;j<props.length;j++) {
						NJS.addWatcher(props[j], function(_a, range, newval, oldLength) {
							NJS.repeatBinding(elem, path, obj, eval(complete), range, oldLength);
						});
					}
					continueBindings = false; //do not bind children (NJS.repeatBinding will take care of doing that)
				} else {
					NJS.setProp(elem, prop, eval(complete));
					for(var j=0;j<props.length;j++) {
						NJS.addWatcher(props[j], function(_a, _b, newval, _c) {
							NJS.setProp(elem, prop, eval(complete));
						});
					}
					tagName = elem.tagName.toLowerCase();
					if (tagName == "input" || (tagName == "select" && prop == "value")){
						for(var j=0;j<props.length;j++) {
							var pathObj = props[j];
							elem.addListener(NJS.getDefaultEvent(elem), function() {
								NJS.getValue(elem, prop, pathObj)
							});
						}
					}
				}
			}
			return continueBindings;
		} catch(e) {
			console.error(e+": "+elem+" - "+prop+" - "+path+" - "+obj);
			console.error(e.stack);
			return true;
		};
	},


	replaceProp: function (str, prop, newName){
		propIndex = NJS.findProp(str, prop);
		while(propIndex != -1){
			str = str.substring(0,propIndex) + newName + str.substring(propIndex+prop.length);
			propIndex = NJS.findProp(str, prop);
		}
		return str;
	},


	findProp: function (str, prop) {
		var propIndex = str.indexOf(prop);
		var totalPropIndex = 0;
		while(propIndex != -1){
			if (propIndex == 0){
				if (NJS.isValidVaribleName(str.charAt(prop.length))){
					str = str.substring(propIndex+prop.length+1);
				} else {
					return 0;
				}
			} else if (propIndex == str.length-prop.length) {
				if (NJS.isValidVaribleName(str.charAt(propIndex-1)) || str.charAt(propIndex-1) == '.'){
					return -1;
				} else {
					return totalPropIndex + propIndex;
				}
			} else {
				if (NJS.isValidVaribleName(str.charAt(propIndex+prop.length)) || NJS.isValidVaribleName(str.charAt(propIndex-1)) || str.charAt(propIndex-1) == '.'){
					str = str.substring(propIndex+prop.length+1);
				} else {
					return totalPropIndex + propIndex;
				}	
			}
			totalPropIndex += (propIndex+prop.length+1);
			propIndex = str.indexOf(prop);
		}
		return -1;
	},


	getPath: function (obj, path, props) {
		var removedStrings = [];
		obj = NJS.removeStrings(obj, removedStrings);

		var pathArray = path.split(".");
		pathArray.pop();
		var replaced = [];
		for (var p=pathArray.length; p>0; p--){
			var tmpPath = pathArray.slice(0,p).join(".");
			var tmpObj = eval(tmpPath);
			for (property in tmpObj){
				var propIndex = NJS.findProp(obj, property);
				if (propIndex >= 0){// && obj.charAt(propIndex+property.length) != '['){ //esclude arrays
					if (NJS.findProp(obj,"../"+property) >= 0){ //TODO: handle ../../
						obj = NJS.replaceProp(obj, "../"+property, "___"+replaced.length);
						replaced.push(tmpPath.split(".").slice(0,-1).join(".")+"."+property);
					} else {
						obj = NJS.replaceProp(obj, property, "___"+replaced.length);
						replaced.push(tmpPath+"."+property);
					}
					//if (obj.indexOf(')',propIndex) < obj.indexOf('(',propIndex)) { //the property is a function parameter
					//	replaced[replaced.length-1].bindRecursive = true;
					//} else {
					//	replaced[replaced.length-1].bindRecursive = false;
					//}
				}
			}
		}
		
		if (NJS.findProp(obj, '$data')>=0) {
			obj = NJS.replaceProp(obj, '$data', "___"+replaced.length);
			replaced.push(path.substring(0, path.length-1));
		}
		
		if (NJS.findProp(obj, '$index')>=0) {
			obj = NJS.replaceProp(obj, '$index', "___"+replaced.length);
			replaced.push(path.substring(path.lastIndexOf('[')+1, path.lastIndexOf(']')));
		}
		
		for (var i=0;i<replaced.length;i++){
			obj = obj.replace(new RegExp("___"+i,"g"), replaced[i]);
			//if (obj.indexOf(replaced[i]+'.length') >= 0) //TODO: da sistemare ============================================
				//replaced[i] += ".length";
			if (!NJS.isFunction(eval(replaced[i]))){ //do not add watcher to a function
				props.push(replaced[i]);
			} else {
				props.push(path.substring(0,path.length-1));
			}
		}
		
		obj = NJS.insertStrings(obj, removedStrings);
		
		console.log("NJS.getPath: "+obj);
		if (props.length == 0)
			props.push(obj);
		
		return obj;
	},


	getBindings: function (elem, path){
		var tmpPath;
		var bindChild = true;
		
		if (path == null) path = "";
		//NJS.createMissingProp(elem,path);
		if (elem.getAttribute){
			var bindstr = elem.getAttribute('bind');
			if (bindstr != null){
				console.log("NJS.getBindings: "+path);
				bindChild = NJS.setBinding(elem, bindstr, path);
			}
			if (bindChild.length){
				path = bindChild+".";
				bindChild = true;
			}
			if (bindChild === true && elem.hasChildNodes()){
				for (var child=0; child<elem.childNodes.length; child++){
					NJS.getBindings(elem.childNodes[child],path);
				}
			}
			
		}
	},


	removeDelimited: function (str, removedStrings, startSymbol, endSymbol) {
		var start=-1;
		var end=0;
		var num=0;
		for (var i=0;i<str.length;i++){
			if (str.charAt(i) == startSymbol){
				num++;
				if (start == -1) start = i;
			} else if (str.charAt(i) == endSymbol){
				num--;
				end = i;
			}
			if (num==0 && start!=-1) {
				removedStrings.push(str.substring(start,end+1));
				start = -1;
			}
		}
		
		for (i=0;i<removedStrings.length;i++){
			str = str.replace(removedStrings[i], "__-"+i);
		}
		
		return str;
	},


	insertDelimited: function (str, removedStrings) {
		for (var i=0;i<removedStrings.length;i++){
			str = str.replace("__-"+i, removedStrings[i]);
		}
		return str;
	},
		

	delimiters: [
		new Delimiter('(',')'),
		new Delimiter('[',']'),
		new Delimiter('{','}')
	],


	splitBindings: function (bindString){
		var removedStrings = [];
		for (d in NJS.delimiters){
			bindString = NJS.removeDelimited(bindString, removedStrings, NJS.delimiters[d].start, NJS.delimiters[d].end);
		}
		var splitted = bindString.split(",");
		for (var i=0;i<splitted.length;i++){
			splitted[i] = NJS.insertDelimited(splitted[i], removedStrings);
		}
		return splitted;
	},


	setBinding: function (elem, bind_string, path){
		var removedStrings = [];
		var ret, separator, b, bsplit, bindChild, prop, value;
		bind_string = NJS.removeStrings(bind_string, removedStrings);
		bsplit = NJS.splitBindings(bind_string);
		
		for (b=0;b<bsplit.length;b++) {
			prop = null; value = null;
			console.log('==>binding: '+NJS.insertStrings(bsplit[b].trim(),removedStrings));
			separator = bsplit[b].indexOf(':');
			if (separator >= 0){
				prop = bsplit[b].substring(0,separator).trim();
				value = bsplit[b].substring(separator+1).trim();
			}
			if (prop != null && NJS.isValidVaribleName(prop)) { // TODO: verificare che bsplit[b][0].trim() sia una property di elem o un evento, altrimenti entrare nell'else
				ret = NJS.bindTo(elem, prop, path, NJS.insertStrings(value,removedStrings));
			} else {
				ret = NJS.bindTo(elem, NJS.getDefaultProp(elem), path, NJS.insertStrings(bsplit[b].trim(),removedStrings));
			}
			if (bindChild != false)
				bindChild = ret;
		}
		return bindChild;
	},


	getDefaultEvent: function (elem){
		switch(elem.type.toLowerCase()){
			case 'text':
				return 'keyup';
			default:
				return 'change';
		}
	},


	getDefaultProp: function (elem){
		switch(elem.tagName.toLowerCase()){
			case 'input':
			case 'select':
				if (elem.type.toLowerCase()=='checkbox')
					return 'checked';
				return 'value';
			default:
				return 'innerHTML';
		}
	},


	fireVisibleEffect: function (elem) {
		if (elem.nodeType == 3 || elem.getAttr('bind-effect')==null) return;
		elem.__displayBackUp = NJS.getStyle(elem, 'display');
		elem.style.display = 'none';
		elem.visible = true;
	},


	getIndex: function (elem, index){
		if (index >= elem.childNodes.length){
			return elem.childNodes.length;
		}
		var i=0, j=0;
		while (j <= index && i < elem.childNodes.length){
			if (!elem.childNodes[i].removed){
				j++;
			}
			i++;
		}
		return i-1;
	},


	removeChildNodes: function (elem, index, howMany){
		index = NJS.getIndex(elem, index);
		for (var i=0;i<howMany;i++){
			if (elem.childNodes[index].getAttr('bind-effect')){
				elem.childNodes[index].visible = false;
				elem.childNodes[index].removed = true;
				index++;
			} else {
				elem.removeChild(elem.childNodes[index]);
			}
		}
	},


	switchChildNodes: function (elem, index1, index2, howMany){
		index1 = NJS.getIndex(elem, index1);
		index2 = NJS.getIndex(elem, index2);
		for (var i=0;i<howMany;i++){
			var temp = elem.childNodes[index1+i].cloneNode(true);
			elem.replaceChild(elem.childNodes[index2+i].cloneNode(true), elem.childNodes[index1+i]);
			elem.replaceChild(temp, elem.childNodes[index2+i]);
		}
	},


	// apply the binding with an array
	repeatBinding: function (elem, path, obj, eobj, range){
		
		// hide the element if it has the hide-if-empty attribute and the binding array is empty
		if (elem.getAttribute('hide-if-empty') != null) {
			if (eobj==null || eobj.length == 0) {
				elem.visible = false;
			} else {
				elem.visible = true;
			}
		}
		
		// get the old binded array
		var oldArray = elem.oldArray || [];
		var newArray = eobj.slice(0);
		
		if (newArray.equalsTo(oldArray)) return;

		var skip;
		if (elem.template === undefined) {
			// get the number of no-repeat elements that must be skipped
			skip = 0; //TODO: skip only empty text nodes
			while(skip<elem.childNodes.length && (elem.childNodes[skip].nodeType == 3 || NJS.isNoRepeat(elem.childNodes[skip]))) {
				skip++;
			}
			elem.skip = skip;
			
			// get the repeater template
			elem.template = [];
			for (child=skip;child<elem.childNodes.length;child++){
				if (elem.childNodes[child].getAttr('no-repeat')==null){
					elem.template.push(elem.childNodes[child].cloneNode(true));
					elem.removeChild(elem.childNodes[child]);
					child--;
				}else{
					break;
				}
			}
			
			// bind no-repeat elements
			for (var j=0;j<elem.childNodes.length;j++){
				if (elem.childNodes[j].getAttr('no-repeat')!=null){
					NJS.createMissingProp(elem.childNodes[j],path);
					NJS.getBindings(elem.childNodes[j],path);
				}
			}
		}
		var tpLen = elem.template.length;
		skip = elem.skip;
		
		// delete children that have been hidden in the previous call of the function
		for (child=0; child<elem.childNodes.length; child++){
			if (elem.childNodes[child].removed){
				elem.removeChild(elem.childNodes[child]);
				child--;
			}
		}
		
		var dynamicIndex = false;
		var tempArray = false;
		//se l'array è generato dinamicamente da una funzione ne creo una copia in una variabile temporanea
		if (obj.indexOf('(')>=0 && (obj.indexOf('(') < obj.indexOf('.')||obj.indexOf('.')==-1)) { //TODO: andrebbe fatto un eval(obj+'is function') con tutti i possibili path. anche perchè se per esempio chiamo una funzione all'interno di un oggetto (es. Obj.function()) lo scambierebbe per il secondo caso
			obj = '__tempArray'+obj.split('(')[0];
			eval(path+obj+'=eobj.slice(0)');
			tempArray = true;
		//se l'array è risultato di una funzione su un array (es. Array.sort) tolgo la funzione dal nome e rimappo gli indici
		}else if (obj.indexOf('.')>=0) {
			obj = obj.split('.')[0];
			dynamicIndex = true;
		}


		// delete removed items
		var j;
		for (j=0; j < oldArray.length; j++){
			if (newArray.indexOf(oldArray[j]) == -1) {
				oldArray.splice(j,1);
				NJS.removeChildNodes(elem, j*tpLen+skip, tpLen);
				j--;
			}
		}
		
		
		// order old items
		var k,z,tmp;
		for (k=0; k < oldArray.length-1; k++) {
			for (z=k; z < oldArray.length; z++) {
				if (newArray.indexOf(oldArray[k]) > newArray.indexOf(oldArray[z])) {
					tmp=oldArray[k];
					oldArray[k] = oldArray[z];
					oldArray[z] = tmp;
					NJS.switchChildNodes(elem, k*tpLen+skip, z*tpLen+skip, tpLen)
				}
			}
		}
		
		// insert new items
		var i,position;
		
		for (i=0; i < newArray.length; i++) {
			var index;
			var isNewItem = false;
			if (newArray[i] === undefined){
				isNewItem = true;
				index = NJS.getIndex(elem, i*tpLen+skip);
			} else if (oldArray.indexOf(newArray[i]) == -1) { // new Item
				isNewItem = true;
				if (i == 0){
					position = 0;
					oldArray.splice(0,0,newArray[i]);
				} else {
					position = oldArray.indexOf(newArray[i-1])+1;
					oldArray.splice(position,0,newArray[i]);
				}
				index = NJS.getIndex(elem, position*tpLen+skip);
			}
			for (var t = 0; t < elem.template.length; t++){
				if (isNewItem) {
					var newItem = elem.template[t].cloneNode(true);
					elem.insertChild(newItem,index+t);
					NJS.fireVisibleEffect(newItem);
				}else{
					index = NJS.getIndex(elem, i*tpLen+skip+t);
					var newItem = elem.childNodes[index].cloneNode(true);
					elem.replaceChild(newItem,elem.childNodes[index]); //to remove listeners
				}
				
				if (newItem.nodeType != 3) {
					if (dynamicIndex){
						newObj = obj+'['+eval(path+obj+'.indexOf(eobj[i])')+']';
					} else {
						newObj = obj+'['+i+']';
					}
					
					NJS.createMissingProp(newItem,path+newObj+'.');
					NJS.getBindings(newItem,path+newObj+'.');
					
					if (!tempArray && !dynamicIndex) {
						try{
							NJS.addWatcher(path+newObj, function(_a, _b, newval, _c) {
								NJS.getBindings(newItem,path+newObj+'.');
							});
						} catch(e) {
							//TODO: SISTEMARE: va in errore quando path+newObj è un array.
						}
					}
				}
			}
		}
		
		elem.oldArray = eobj.slice(0);
	},

	init: function (){
		var body = document.getElementsByTagName('body')[0];
		NJS.createMissingProp(body, '');
		NJS.getBindings(body);
	}

};


//////////////
//prototypes//
//////////////
try {
	Object.defineProperty(HTMLElement.prototype, "__displayBackUp",{
		enumerable: false,
		configurable: true,
		writable: true,
		value: "block"
	 });
	 
	Object.defineProperty(HTMLElement.prototype, "visible",{
		get: function() {
			if (NJS.getStyle(this, 'display').toLowerCase() == 'none')
				return false;
			return true;
		},
		set: function(newValue){
			if (this.getAttribute("bind-effect") != null) {
				if (this.removed && eval(newValue)){
					this.parentNode.removeChild(this);
				}
				var effectFunction = this.getAttribute("bind-effect");
				if (effectFunction.indexOf('(')>0)
					effectFunction = effectFunction.split('(')[0];
				eval(effectFunction).call(this, eval(newValue));
			} else if (eval(newValue)) {
				if (NJS.getStyle(this, 'display').toLowerCase() == 'none') {
					if (this.__displayBackUp.toLowerCase() != 'none'){
						this.style.display = this.__displayBackUp;
					} else {
						if (this.nodeName.toLowerCase() == 'span'){
							this.style.display = "inline";
						} else {
							this.style.display = "block";
						}
					}
				}
			} else {
				this.__displayBackUp = NJS.getStyle(this, 'display');
				this.style.display = 'none';
			}
		}
	});
} catch (e) {
	Object.defineProperty(Element.prototype, "__displayBackUp",{
		enumerable: false,
		configurable: true,
		writable: true,
		value: "block"
	 });
	 
	Object.defineProperty(Element.prototype, "visible",{
		get: function() {
			if (NJS.getStyle(this, 'display').toLowerCase() == 'none')
				return false;
			return true;
		},
		set: function(newValue){
			if (eval(newValue)) {
				if (NJS.getStyle(this, 'display').toLowerCase() == 'none')
					this.style.display = this.__displayBackUp;
			} else {
				this.__displayBackUp = NJS.getStyle(this, 'display');
				this.style.display = 'none';
			}
		}
	});
}


Object.defineProperty(Element.prototype, "focused",{
	get: function() {
		return (document.activeElement == this);
	},
	set: function(newValue){
		if (newValue) {
			this.focus();
		} else {
			this.blur();
		}
	}
});


Element.prototype.addListener = function(event, handler){
	if (this.addEventListener) {
		this.addEventListener(event, handler, false); 
	} else if (this.attachEvent)  {
		this.attachEvent('on'+event, handler);
	}
};


Node.prototype.getAttr = function(attrName){
	if (this.getAttribute)
		return this.getAttribute(attrName)
	return null;
}

Node.prototype.insertAfter = function(newItem, element){
	if (element.nextSibling == null){
		element.parentNode.appendChild(newItem);
	}else{
		element.parentNode.insertBefore(newItem,element.nextSibling);
	}
}

Node.prototype.insertChild = function(newItem, index){
	if (index >= this.length){
		this.appendChild(newItem);
	}else{
		this.insertBefore(newItem,this.childNodes[index]);
	}
}


if(!String.prototype.trim) {
  String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g,'');
  };
}

Array.prototype.toggleSortBy = function(prop) {
	if (this.sortOrder == prop + ' asc'){
		this.sortBy(prop + ' desc')
	} else {
		this.sortBy(prop + ' asc')
	}
}

Array.prototype.sortOrder = ""; 

Array.prototype.orderBy = function(order) {
    var copy = this.slice(0);
    return copy.sortBy(order);
}

Array.prototype.sortBy = function(sortStr) {
	var prop, order;
	var splitted = sortStr.split(' ');
	if (splitted.length > 1){
		prop = splitted[0];
		order = splitted[1];
	} else {
		prop = sortStr;
		order = 'asc';
	}
	
	this.sortOrder = prop + ' ' + order;
	
	if (order == 'asc' || order == 'ascending') {
		order = 1;
	} else if (order == 'desc' || order == 'descending'){
		order = -1;
	} else {
		throw "sortBy: order can be 'asc' or 'desc' only";
	}

	return this.sort(function(a,b) {
		if (a[prop]>b[prop])
		return order;
		return -order;
	});
};

Array.prototype.search = function() {
	var notGeneric = /[^\?\.\+\*\^\$]+/g;
	for (i=0; i<arguments.length/2; i++) {
		notGeneric.lastIndex = 0;
		if (notGeneric.test(arguments[i*2])) {
			return this.filter.apply(this, arguments);
		}
	}
	return new Array();
}

Array.prototype.filter = function() {
	var retArray = [], filters = [], i, j, type;
	if (arguments.length==1) {
		if (this[0] != null && (typeof this[0]).toUpperCase() == 'OBJECT'){
			for (var prop in this[0]){
				if (this[0][prop] != null){
					type = this[0][prop].constructor.name.toUpperCase()
					if (type == "STRING" || type == "NUMBER" || type == "BOOLEAN")
						filters.push({exp: NJS.createRegExp(arguments[0]), prop: prop});
				}
			}
		} else {
			filters.push({exp: NJS.createRegExp(arguments[0]), prop: null});
		}
	} else {
		for (i=0; i<arguments.length/2; i++) {
			filters.push({exp: NJS.createRegExp(arguments[i*2]), prop: arguments[i*2+1]});
		}
	}
	
	for (i=0;i<this.length;i++){
		if (filters[0].prop == null){
			if (filters[0].exp.test(this[i])){
				retArray.push(this[i]);
			}
		} else {
			for (j=0; j<filters.length; j++){
				if (this[i][filters[j].prop] != null){
					if (filters[j].exp.test(this[i][filters[j].prop])){
						retArray.push(this[i]);
						break;
					}
				}
			}
		}
	}
	
	return retArray;
}

Array.prototype.equalsTo = function(arrayToCompare){
	if (this.length != arrayToCompare.length)
		return false;

	for (var i=0;i<this.length;i++) {
		if (this[i] != arrayToCompare[i])
			return false;
	}
	return true;
}

//end of prototypes

function Delimiter (start,end){
	this.start = start;
	this.end = end;
};

// bind-effects
function slide(visible){
	visible ? $(this).slideDown() : $(this).slideUp()
}

function fade(visible){
	visible ? $(this).fadeIn() : $(this).fadeOut()
}

document.addEventListener("DOMContentLoaded", function(){NJS.init()});
