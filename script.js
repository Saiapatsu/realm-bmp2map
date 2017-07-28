const CHANNELS_PER_PIXEL = 4; //rgba
const layers = [document.getElementById("layer1"), document.getElementById("layer2"), document.getElementById("layer3")]; //, document.getElementById("walls"), document.getElementById("objects")]
const canvas = document.getElementById("canvas");
const icanvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const say = document.getElementById("say");
let msgs = {}; // list of errors encountered so far and their elements - [element, timeout]

for (var i = 0; i < layers.length; i++) {
  let source = layers[i];
  inputImage(source.children[2].files[0], source);
  inputPalette(source.children[4].files[0], source);
  source.children[2].addEventListener("change", function() {
    inputImage(source.children[2].files[0], source);
  });
  source.children[4].addEventListener("change", function() {
    inputPalette(source.children[4].files[0], source);
  });
}

function inputImage(file, source) {
  if (file && file.type.match('image.*')) {
    // console.log(file.type);
    let fr = new FileReader();
    fr.onload = function() {
      source.children[0].src = this.result;
    };
    fr.readAsDataURL(file);
  }
}

function inputPalette(file, source) {
  if (file) {
    // console.log(file.type);
    let fr = new FileReader();
    fr.onload = function() {
      source.children[1].value = this.result;
    };
    fr.readAsText(file);
  }
}

function saymessage(msg) {
  if (!msgs[msg]) {
    console.log("New");
    let element = document.createElement("span");
    element.innerHTML = msg;
    say.appendChild(element);
    msgs[msg] = [element];
  }
  if (msgs[msg][1]) {
    console.log("Clearing");
    clearTimeout(msgs[msg][1]);
    msgs[msg][1] = null;
  }
    console.log("Doing");
  msgs[msg][0].style.display = null;
  msgs[msg][1] = setTimeout(() => {
    msgs[msg][0].style.display = "none";
    msgs[msg][1] = null;
  }, 3000)
  /*
  var element = document.createElement("span");
  element.innerHTML = msg;
  // element.class = "say"; // just use #say span
  say.appendChild(element);
  saytimeout = setTimeout(() => {
    say.removeChild(element);
  }, 3000);
  */
}

function stringifyRGB(r, g, b) {
  // return ((r & 0xFF) << 24) + ((g & 0xFF) << 16) + ((b & 0xFF) << 8) + (a & 0xFF);
  // return parseInt(r.toString(2) + g.toString(2) + b.toString(2) + a.toString(2), 2);
  // return parseInt(r.toString(2).padStart(8, "0") + g.toString(2).padStart(8, "0") + b.toString(2).padStart(8, "0") + a.toString(2).padStart(8, "0"), 2);
  return r << 16 | g << 8 | b
}

function generateJM() {
  var mylayers = layers.map((layer) => {
    // dom object, its image tag, its palette string, its palette object, (not included) pixel data
    return [layer, layer.children[0], layer.children[1].value, {}];
  }).filter((layer, index) => {
    // is layer.children[0].src (if empty in the document) equaling window.location.href intended behavior?
    return (layer[1].src && layer[1].src != window.location.href || saymessage("Layer #" + (index+1) + " missing image")) && (layer[2] || saymessage("Layer #" + (index+1) + " missing palette")) && (layer[2].startsWith("GIMP Palette") || saymessage("Layer #" + (index+1) + " obviously invalid palette"));
  });
  console.log(mylayers);
  if (mylayers.length == 0) {
    saymessage("Nothing to do");
    return;
  }

  // parse palettes
  for (var j = 0; j < mylayers.length; j++) {
    var palette = mylayers[j][3]; // key: rgb, value: tile info
    var lines = mylayers[j][2].split("\n");
    lines.pop(); // trailing newline
    var i = 0
    while (lines[i] != "#" && i < lines.length) {i++;}
    for (var i = i+1; i < lines.length; i++) {
      var sides = lines[i].split("\t");
      sides[0] = sides[0].replace(/^ +/g,''); // leading whitespace
      sides[0] = sides[0].replace(/ +/g,' '); // duplicate whitespace
      var rgb = sides[0].split(" ");
      // HACK
      palette[stringifyRGB(rgb[0], rgb[1], rgb[2])] = sides[1];
    }
    console.log(palette);
  }


  // get largest image size
  var width = Math.max(...mylayers.map((x) => {
    return x[1].width;
  }));
  var height = Math.max(...mylayers.map((x) => {
    return x[1].height;
  }));

  var ctx = icanvas.getContext('2d');
  for (var i = 0; i < mylayers.length; i++) {
    let img = mylayers[i][1];
    icanvas.width = width;
    icanvas.height = height;
    ctx.drawImage(img, 0, 0);
    mylayers[i][4] = (ctx.getImageData(0, 0, width, height)).data;
  }

  var dict = [];
  var undict = {}; // reverse
  var oi = 1; // output array, incremented by 2 each time
  var di = 0;
  var pixlength = mylayers[0][4].length; // just in case forloop evaluates 2nd thing more than 1ce
  var data = new Uint8Array(pixlength/CHANNELS_PER_PIXEL*2);
  for (var i = 0; i < pixlength; i += CHANNELS_PER_PIXEL, oi += 2) {
    var concat = [];
    for (var j = 0; j < mylayers.length; j++) {
      var pixData = mylayers[j][4];
      if (pixData[i+3]) {
        var color = stringifyRGB(pixData[i], pixData[i+1], pixData[i+2]);
        var result = mylayers[j][3][color];
        if (result) {
          concat.push(result);
        }
      }
    }
    concat = "{" + concat.join() + "}";
    var key = undict[concat];
    if (key != null) {
      data[oi] = key;
    } else {
      dict.push(concat);
      data[oi] = undict[concat] = di;
      di++;
    }
  }
  // console.log(data);
  // console.log(dict);
  /*
  var data = new Uint8Array(pixData.length/CHANNELS_PER_PIXEL*2); // HACK: *2
  var pointer = 1;
  for (var i = 0; i < pixData.length; i += CHANNELS_PER_PIXEL, pointer += 2) {
    data[pointer] = palette[stringifyRGB(pixData[i], pixData[i+1], pixData[i+2])];
  }
  console.log(data);
  */

  document.getElementById("outjm").value = JSON.stringify({width: width, height: height, dict: dict.concat(), data: btoa(pako.deflate(data, {to: "string", level: "9"}))}).replace(/}"/g,'}').replace(/"{/g,'{').replace(/\\/g,'');
  saymessage("Successfully created map");
}
/*
function processJson(file) {
  // Parse map file
  var jsonmap = JSON.parse(file);

  // Get some base64 encoded binary data from the file:
  var b64Data = jsonmap.data;

  // Decode base64 (convert ascii to binary)
  var strData = atob(b64Data);

  // Convert binary string to character-number array
  var charData = strData.split("").map(function(x){return x.charCodeAt(0);});

  // Turn number array into byte-array
  var binData = new Uint8Array(charData);

  // Pako magic
  var data = pako.inflate(binData);

  // Check reverse
  var strData2 = pako.deflate(data, {to: "string", level: "9"});

  var b64Data2 = btoa(strData2);

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
