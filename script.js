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
let msgs = {}; // list of messages encountered so far and their elements - key: msg string, value: [node, timeout]
// TODO: clean it out when timeout expires, add a counter, add specifiable color

// Output
const outjm = document.getElementById("outjm")
const outgpl = document.getElementById("outgpl")

function clearInput(reload) {
  while (pregpl.firstChild) {
    pregpl.removeChild(pregpl.firstChild);
  }
  while (prebmp.firstChild) {
    prebmp.removeChild(prebmp.firstChild);
  }
  if (!reload) {
    allfiles = [];
    form.reset();
    outjm.value = "";
    outgpl.value = "";
  }
}

function reloadInput() {
  clearInput(true);
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
  if (!msgs[msg]) {
    let element = document.createElement("span");
    element.innerHTML = msg;
    say.appendChild(element);
    msgs[msg] = [element];
  }
  if (msgs[msg][1]) {
    clearTimeout(msgs[msg][1]);
    msgs[msg][1] = null;
  }
  msgs[msg][0].style.display = null;
  msgs[msg][1] = setTimeout(() => {
    msgs[msg][0].style.display = "none";
    msgs[msg][1] = null;
  }, 3000)
}

// function RGB24(r, g, b) {
//   return r << 16 | g << 8 | b
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
//   if (data > 255) {
//     to[i] = data & 65280;
//     to[i + 1] = data & 255;
//   } else {
//     to[i + 1] = data;
//   }
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

  // Read images and palettes
  let dict = [];
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
        } else {
          sayMessage("Color " + RGBHex(pixdata[i], pixdata[i+1], pixdata[i+2]) + " not found on the palette, ignored");
        }
      }
    }
    tile = "{" + tile.join() + "}";
    let key = undict[tile];
    if (key != null) {
      // setData()
      bytedata[(i >> 1) + 1] = key; // >> 1 divides by 2 (which is 2 to the power of 1), and we know our i is always even. thanks for reading my code
    } else {
      bytedata[(i >> 1) + 1] = undict[tile] = dict.push(tile) - 1;
    }
  }
  if (dict.length === 1 && dict[0] == "{}") {
    // This would a perfectly valid map but let's gawk anyway
    sayMessage("Something ain't right, none of the colors in the palette match any of the colors in any of the images");
  } else {
    let tempjm = JSON.stringify({width: width, height: height, dict: dict.concat(), data: btoa(pako.deflate(bytedata, {to: "string", level: "9"}))}).replace(/}"/g,'}').replace(/"{/g,'{').replace(/\\/g,'');
    try {
		JSON.parse(tempjm);
		sayMessage("Successfully rendered map");
	} catch(e) {
		sayMessage("JSON is malformed, check your color names");
	}
	outjm.value = tempjm;
	outjm.select();
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

function saveJm() {
  if (!outjm.value) {
    renderJm();
  }
  if (outjm.value) {
    saveAs(new Blob([outjm.value], {type: "text/plain;charset=utf-8"}), "map.jm");
  }
}

function saveGpl() {
  if (!outgpl.value) {
    renderGpl();
  }
  if (outgpl.value) {
    saveAs(new Blob([outgpl.value], {type: "text/plain;charset=utf-8"}), "palette.gpl");
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

// We have JS!
document.body.removeChild(document.body.firstChild);
