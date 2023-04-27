// Input and previews
const input = document.getElementById("input");
const pregpl = document.getElementById("pregpl");
const prebmp = document.getElementById("prebmp");
const cpygpl = pregpl.removeChild(pregpl.firstChild);
const cpybmp = prebmp.removeChild(prebmp.firstChild);
const form = input.parentElement;
let allfiles = []; // contains all files put in the input

// Working canvas
const CHANNELS_PER_PIXEL = 4; // RGBA
const canvas = document.createElement("canvas");
const ctx = canvas.getContext('2d');

// Reporter
const say = document.getElementById("say");

// Output
const filenamein = document.getElementById("filename")
const filenameindex = document.getElementById("filenameIndex")
const outjm = document.getElementById("outjm")
const outgpl = document.getElementById("outgpl")

function clearInput(intent) {
	if (intent != "images") { // rigid and inextensible, just like the rest of this project
		while (pregpl.firstChild) {
			pregpl.removeChild(pregpl.firstChild);
		}
	}
	if (intent != "palette") { // rigid and inextensible, just like the rest of this project
		while (prebmp.firstChild) {
			prebmp.removeChild(prebmp.firstChild);
		}
	}
	if (intent === "all") {
		allfiles = [];
		form.reset();
		outjm.value = "";
		outgpl.value = "";
	}
}

function reloadInput() {
	clearInput('reload');
	fileInput(true);
}

function fileInput(reload) {
	let files;
	if (reload) {
		files = allfiles;
		// TODO: call the reset function
	} else {
		files = input.files;
		allfiles.push.apply(allfiles, files); // push the contents of files to allfiles
	}
	for (let f = 0; f < files.length; f++) {
		let file = files[f];
		let fr = new FileReader();
		if (file.type.match("image.*")) {
			fr.onload = function() {
				let image = cpybmp.cloneNode(true);
				image.firstChild.src = this.result;
			image.lastChild.addEventListener("click", () => {
			prebmp.removeChild(image);
			});
				prebmp.appendChild(image);
			};
			fr.readAsDataURL(file);
		} else {
			fr.onload = function() {
				if (this.result.startsWith("GIMP Palette\n")) {
					let lines = this.result.split("\n");
					lines.pop(); // trailing newline
					let i = 1;
					while (lines[i] != "#" && i < lines.length) {i++;}
					for (i = i+1; i < lines.length; i++) {
						newColor(lines[i]);
					}
				} else {
					sayMessage(file.name + " is neither an image nor a palette");
				}
			};
			fr.readAsText(file);
		}
	}
}
fileInput();

function newColor(line) {
	// create an entry in the document
	let color = cpygpl.cloneNode(true);
	if (line) {
		// example line input:
		//  58  86 110	"ground":"Blue Closed"
		// 154  27  27	"regions":[{"id":"Arena Central Spawn"}]
		let sides = line.split("\t");
		sides[0] = sides[0].replace(/^ +/g,'').replace(/ +/g,' '); // leading and duplicate whitespace
		let rgb = sides[0].split(" ");
		// convert to hex
		color.children[0].value = RGBHex(...rgb);
		color.children[1].value = sides[1];
	}
	color.lastChild.addEventListener("click", () => {
		pregpl.removeChild(color);
	});
	pregpl.appendChild(color);
}

function sayMessage(msg) {
	console.log(msg);
	// let element = document.createElement("li");
	// element.innerText = msg;
	// say.appendChild(element);
	say.value += msg + "\n";
	say.scrollTop = say.scrollHeight;
}

function clearSay() {
	say.removeChildren();
}

// function RGB24(r, g, b) {
// 	return r << 16 | g << 8 | b
// }

function RGBHex() {
	let hex = "#";
	for (var i = 0; i < arguments.length; i++) {
		let dec = parseInt(arguments[i]);
		hex += dec < 16 ? "0" + dec.toString(16) : dec.toString(16);
	}
	return hex;
}

// Hex24 used to be here but it's a one line wonder used only once

// HexRGB is in the gpl saver

// function setData(to, data, i) {
// 	if (data > 255) {
// 		to[i] = data & 65280;
// 		to[i + 1] = data & 255;
// 	} else {
// 		to[i + 1] = data;
// 	}
// }

function renderJm() {
	// sanity checks
	if (!pregpl.firstChild) {
		sayMessage("No palettes loaded");
		return;
	}
	if (!prebmp.firstChild) {
		sayMessage("No images loaded");
		return;
	}

	// get largest image size
	let images = prebmp.children;
	// 2018-10-08 19:57:07 Stopped using Array.map on htmlcollection
	var width = 0, height = 0;
	for (i = 0; i < images.length; i++) {
		width = Math.max(width, images[i].firstChild.width);
		height = Math.max(height, images[i].firstChild.height);
	}
	canvas.width = width;
	canvas.height = height;

	// load image data array
	// 2018-10-08 19:57:07 Stopped using Array.map on htmlcollection
	images = (() => { // create an anonymous function, run it and set variable
		//"images" to point to the function's return value, which is
		// a new, writeable array
		var spaghetticode = [];
		for (i = 0; i < images.length; i++) {
				ctx.clearRect(0, 0, width, height);
				ctx.drawImage(images[i].firstChild, 0, 0);
				spaghetticode.push(ctx.getImageData(0, 0, width, height).data);
		}
		return spaghetticode;
	})();

	// load palettes
	let palette = {};
	for (var i = 0; i < pregpl.children.length; i++) {
		palette[parseInt(pregpl.children[i].children[0].value.slice(1), 16)] = pregpl.children[i].children[1].value;
	}
	
	// averts console spam when a color is "not found on the palette"
	const knownMissing = {};

	// Read images and palettes
	let dict = []; // Array of stringified json objects, each representing one dict entry
	let undict = {}; // reverse
	let pixlength = width*height*CHANNELS_PER_PIXEL; // just in case forloop evaluates 2nd expression more than 1ce
	let bytedata = new Uint8Array(pixlength/CHANNELS_PER_PIXEL*2);
	// i: current bitmap data index - +0: red, +1: green, +2: blue, +3: alpha
	for (let i = 0; i < pixlength; i += CHANNELS_PER_PIXEL) {
		let tile = []; // tile definitions, i.e. the stuff in the palette color names
		for (let j = 0; j < images.length; j++) {
			let pixdata = images[j];
			if (pixdata[i+3]) {
				let color = pixdata[i] << 16 | pixdata[i+1] << 8 | pixdata[i+2]; // RGB24
				if (palette[color]) {
					tile.push(palette[color]);
				} else if (!knownMissing[color]) {
					knownMissing[color] = true;
					sayMessage(`Color ${RGBHex(pixdata[i], pixdata[i+1], pixdata[i+2])} ${pixdata[i]} ${pixdata[i+1]} ${pixdata[i+2]} not found on the palette, ignored`);
				}
			}
		}
		tile = "{" + tile.join() + "}";
		let key = undict[tile];
		const endiancoeff = document.getElementById("isLittleEndian").checked ? 0 : 1;
		if (key != null) {
			// setData()
			bytedata[(i >> 1) + endiancoeff] = key; // >> 1 divides by 2 (which is 2 to the power of 1), and we know our i is always even. thanks for reading my code
			// retro: i is always even because it is incremented by CHANNELS_PER_PIXEL
			// we write every second byte because we're actually writing shorts
		} else {
			bytedata[(i >> 1) + endiancoeff] = undict[tile] = dict.push(tile) - 1;
		}
	}
	if (dict.length === 1 && dict[0] == "{}") {
		// This would a perfectly valid map but let's croak anyway
		sayMessage("Something ain't right, none of the colors in the palette match any of the colors in any of the images");
		
	} else {
		let dictReal;
		try {
			dictReal = dict.map(JSON.parse);
		} catch(e) {
			sayMessage("Dictionary is malformed:");
			sayMessage(e);
			console.log(e);
			console.log(dict);
			throw e;
		}
		
		function Boris_Kischak(       bytes         ) {
			var binary = ``;
			const len = bytes.byteLength;
			for (var i = 0; i < len; i++) {
				binary += String.fromCharCode(     bytes[      i      ]          );
			}
			return btoa(				 			  binary 	   		    	);
		}
		
		// const jm = {
			// width: width,
			// height: height,
			// dict: dictReal,
			// data: btoa(pako.deflate(bytedata, {to: "string", level: "9"}))
		// }
			const jmStr = `{
"width":${width},
"height":${height},
"dict":[${dict.map(x => "\n" + x).join()}],
"data":"${Boris_Kischak(pako.deflate(bytedata, {to: "string", level: "9"}))}"
}`
		
		// outjm.value = JSON.stringify(jm);
		outjm.value = jmStr;
		outjm.select();
		sayMessage("Successfully rendered map");
	}
}

function renderGpl() {
	let gpl = "GIMP Palette\n#\n";
	let pad = "    ";
	for (var i = 0; i < pregpl.children.length; i++) {
		let color = parseInt(pregpl.children[i].children[0].value.slice(1), 16);
		// & is of lower precedence than <<>>
		let byte = (color & 255 << 16) >> 16;
		gpl += pad.slice(byte.toString().length + 1) + byte;
		byte = (color & 255 << 8) >> 8;
		gpl += pad.slice(byte.toString().length) + byte;
		byte = color & 255;
		gpl += pad.slice(byte.toString().length) + byte;
		gpl += "\t" + pregpl.children[i].children[1].value + "\n";
	}
	sayMessage("Successfully generated palette");
	outgpl.value = gpl;
	outgpl.select();
}

function renderFilename(increase) {
	// get #filename.value
	// substitute file list and increasing number
	const index = parseInt(filenameIndex.value);
	const indexCopy = increase ? index + 1 : index;
	return filenamein.value.replace(/%[dn%]/g,(match)=>{
		if (match == "%n") {
			if (increase) {
				filenameIndex.value = indexCopy; // we've used the count, so save it now
				persist(filenameIndex, "1"); // save index to local storage. rise high
			}
			return index;
		} else if (match == "%d") {
			// timestamp in seconds
			return Math.floor(Date.now() / 1000);
		/*
		} else if (match == "%f") {
			return allfiles.map((file)=>{
				return file.name
			}).join(" ")
		*/ // this is where the massive code debt of this fucked me over. not that it's impossible but I'm getting too disgusted to put a filename on each of the images so I can know their filenames
		} else {
			return "%";
		}
	});
}

function saveJm() {
	outjm.value = "";
	renderJm();
	if (outjm.value) {
		saveAs(new Blob([outjm.value], {type: "text/plain;charset=utf-8"}), (renderFilename(true) + ".jm") || "map.jm", {autoBom: false});
	}
}

function saveGpl() {
	outgpl.value = "";
	renderGpl();
	if (outgpl.value) {
		saveAs(new Blob([outgpl.value], {type: "text/plain;charset=utf-8"}), (renderFilename(false) + ".gpl") || "palette.gpl", {autoBom: false}); // does not increase index
	}
}

/*
function processJson(file) {
	// Parse map file
	let jsonmap = JSON.parse(file);

	// Get some base64 encoded binary data from the file:
	let b64Data = jsonmap.data;

	// Decode base64 (convert ascii to binary)
	let strData = atob(b64Data);

	// Convert binary string to character-number array
	let charData = strData.split("").map(function(x){return x.charCodeAt(0);});

	// Turn number array into byte-array
	let binData = new Uint8Array(charData);

	// Pako magic
	let data = pako.inflate(binData);

	// Check reverse
	let strData2 = pako.deflate(data, {to: "string", level: "9"});

	let b64Data2 = btoa(strData2);

	// Output to console
	console.log(file);
	console.log("b64", b64Data);
	console.log("str", strData);
	console.log("char", charData);
	console.log("bin", binData);
	console.log("data", data);
	console.log("str2", strData2);
	console.log("b642", b64Data2);
}
*/

// is there no better way to just get an input's "value"?
function getKey(elem) {
	return elem.type == "checkbox" ? "checked" : "value";
}

function changePrefsEvent(e, def) {
	console.log(e, def);
	return persist(e.target, def);
}

function persist(elem, def) {
	const key = getKey(elem);
	if (elem[key] == def) {
		localStorage.removeItem(elem.id);
	} else {
		localStorage.setItem(elem.id, elem[key]);
	}
}

function loadPrefs() {
	// is it worth trying to avoid destructuring/ecma-whatever-my-browser-supports-but-older-browsers-don't syntax?
	Object.entries(localStorage).forEach(pair => {
		const input = document.getElementById(pair[0]);
		if (!input) return;
		const key = getKey(input);
		input[key] = pair[1];
	});
}

// We have JS!
document.getElementById("noscript").remove();

loadPrefs()
