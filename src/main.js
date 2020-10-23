const WIDTH = 720;
const HEIGHT = 480;

// stats
let stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

// app
let app = new PIXI.Application({
  width: WIDTH,
  height: HEIGHT
});
document.body.appendChild(app.view);
app.renderer.backgroundColor = 0x000000;

// v5 ticker
let ticker = PIXI.Ticker.shared;
ticker.autoStart = false;
ticker.add(function (time) {
  // app.renderer;
  // console.log("render...", time);
  update(time);
});

// init
let bg;
let ASSET_BG = "images/pic_water.jpg";

let container_bg = new PIXI.Container();
container_bg.x = 0;
container_bg.y = 0;
app.stage.addChild(container_bg);

let container = new PIXI.Container();
container.width = WIDTH;
container.height = HEIGHT;
container.x = 0;
container.y = 0;
container.pivot.x = 0;
container.pivot.y = 0;
container.interactive = true;
app.stage.addChild(container);

// shader
let hexColorToVec3 = (hexString) => {
  //check if valid hex value
  if (/^#([0-9A-F]{3}){1,2}$/i.test(hexString)) {
    // Extracted from: https://github.com/mrdoob/three.js/blob/dev/src/math/Color.js#L229

    const match = /^\#([A-Fa-f0-9]+)$/.exec(hexString);
    const hex = match[1];
    const size = hex.length;

    if (size === 3) {

      // #ff0
      const output = [
        parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255,
        parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255,
        parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255,
      ];

      return output;

    } else if (size === 6) {

      // #ff0000
      const output = [
        parseInt(hex.charAt(0) + hex.charAt(1), 16) / 255,
        parseInt(hex.charAt(2) + hex.charAt(3), 16) / 255,
        parseInt(hex.charAt(4) + hex.charAt(5), 16) / 255,
      ];

      return output;

    }

  } else {
    throw new Error('The passed hex color is not valid.');
  }
}

const frag = `
     // Original fragment shader extracted from:
     // https://gist.github.com/OmarShehata/9650b8ee419db3696ce555f10712d499
     precision mediump float;
     // Cant be named 'resolution' since it's a default uniform
     // provided by PIXI.Filter(), see: https://pixijs.download/dev/docs/PIXI.Filter.html
     // And the PIXI's resolution unifmor is the ratio of screen (CSS) pixels to real pixels.
     uniform vec2  dimensions;
     uniform float time;
     uniform vec2  speed;
     
     // Smoke colors
     uniform vec3  smoke1_color_a;
     uniform vec3  smoke1_color_b;
     
     uniform vec3  smoke2_color_a;
     uniform vec3  smoke2_color_b;
     
     // Used to increase the brightness of the image on transitions.
     uniform float brightness; // 0.5 by default.
     
     float rand(vec2 n) {
       // This is just a compounded expression to simulate a random number based on a seed given as n.
       // fract() returns the fractional part of x. This is calculated as x - floor(x).
       // This is like a (x % 1) operation.
       // see more in: https://thebookofshaders.com/10/
       return fract(cos(dot(n, vec2(2.9898, 10.1414))) * 15.5453);
     }
     
     float noise(vec2 n) {
       const vec2 d = vec2(0.0, 1.0);
       vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
       return mix(mix(rand(b), rand(b + d.yx), f.x), mix(rand(b + d.xy), rand(b + d.yy), f.x), f.y);
     }
     
     
     float fbm(vec2 n) {
       // fbm stands for 'Fractal Brownian Motion',
       // see more in: https://thebookofshaders.com/13/
       // https://en.wikipedia.org/wiki/Fractional_Brownian_motion
       float gain = 0.5;
       // we successively increment the frequencies in regular steps (lacunarity).
       float lacunarity = 2.15; // this is a magic number to generate a little bit of distortion.
     
       float total = 0.0, amplitude = 1.0;
       for (int i = 0; i < 10; i++) {
         total += noise(n) * amplitude;
         // n += n; // lacunarity, increments 1 octave in each cycle.
         // lacunarity increments frequency exponentially each cycle in a factor
         // to genereta a litle of distortion.
         n *= lacunarity;
         // Decreases the amplitud by half each iteration.
         amplitude *= gain;
       }
       return total;
     }
     
     void main() {
       // vec3 c1 = vec3(0.25, 0.0, 0.0);
       vec3 c1 = smoke1_color_a;
       // const vec3 c2 = vec3(255.0/255.0, 5.0/255.0, 5.0/255.0);
       vec3 c2 = smoke1_color_b;
     
       // const vec3 c3 = vec3(0.8, 1.0, 0.3);
       vec3 c3 = smoke2_color_a;
       // const vec3 c4 = vec3(0.95, 0.95, 0.95);
       vec3 c4 = smoke2_color_b;
     
       vec3 c5 = vec3(0.6);
       vec3 c6 = vec3(-1.5);
     
       // vec2 p = gl_FragCoord.xy * 3.0 / dimensions.xx;
       vec2 p = gl_FragCoord.xy * 3.0 / dimensions.xx;
     
       float q = fbm(p - time * 0.02);
     
       vec2 r = vec2(fbm(p + q + time * speed.x - p.x - p.y), fbm(p + q - time * speed.y));
     
       vec3 c = mix(c1, c2, fbm(p + r)) + mix(c3, c4, r.x) - mix(c5, c6, r.y);
     
       // Just a cyclic number to multiply with the c color.
       // the name of this variable has nothing to do with the alpha-premultiply algorithm.
       // I'm no longer passing the shift as an uniform since I need magic numbers.
       // float premultiplier = 1.0 - sin(shift * gl_FragCoord.y / dimensions.y);
       float premultiplier = 1.0 - sin(0.9 * gl_FragCoord.y / dimensions.y);
       vec3 endColor = c * premultiplier;
     
       gl_FragColor = vec4(endColor * brightness, 0.0);
       // Uncomment the next line to debug colors and smoke effect without brightness parameters.
       // gl_FragColor = vec4(endColor * 1.0, 0.);
     
       // To produce the volumetric fog effect.
       // https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process
       vec2 st = gl_FragCoord.xy/dimensions.xy;
       vec2 pos = vec2(0.15,0.1)-st;
     
       // when brightness <= 0.3, smoothstep returns: 0.0
       // when brightness in (0.3, 2.0) range, smoothstep returns: hermite interpolation between 0 and 1.
       // when brightness >= 2.0, smoothstep returns: 1.0
       // The brightnessSlider is used to make all the mask clear during transitions (hide the center circle from the mask).
       float brightnessSlider = smoothstep( 0.3, 2.0, brightness );
       float aperture = mix(0.4, -0.5, brightnessSlider);
       float centerMask = smoothstep( aperture, .56, distance(st, vec2(-0.1, 0.75)) ) * r.x;
       // Uncomment next line and comment the last one to debug only mask.
       gl_FragColor = vec4(vec3(centerMask), 1.);
       // gl_FragColor.xyz *= centerMask;
     }
     `;

let myUniforms = {
  dimensions: [WIDTH, HEIGHT],
  time: 0,

  // TODO: Decide wether remove 'speed' uniform or not.
  // This multiplies the frequency in the fbm functions.
  speed: [0.8, 0.7], // speed in each component.

  // Smoke colors
  smoke1_color_a: hexColorToVec3('#EC10FF'),
  smoke1_color_b: hexColorToVec3('#86D609'),

  smoke2_color_a: hexColorToVec3('#06D7F9'),
  smoke2_color_b: hexColorToVec3('#06D7F9'),

  // Used to increase the brightness of the image on transitions.
  brightness: 0.2,
}

let smokeShader = new PIXI.Filter(undefined, frag, myUniforms);
smokeShader.uniforms.dimensions = [WIDTH, HEIGHT];
smokeShader.uniforms.time = 0;
smokeShader.uniforms.speed = [0.8, 0.7];
smokeShader.uniforms.brightness = 0.1;
smokeShader.uniforms.smoke1_color_a = hexColorToVec3('#EC10FF');
smokeShader.uniforms.smoke1_color_b = hexColorToVec3('#86D609');
smokeShader.uniforms.smoke2_color_a = hexColorToVec3('#06D7F9');
smokeShader.uniforms.smoke2_color_b = hexColorToVec3('#06D7F9');

let count = 0;

// loader
let loader = new PIXI.Loader();
loader.add("bg_data", ASSET_BG);

/**
 * Asset load Complete
 * @param { object } loader object
 * @param { object } resources asset data
 */
loader.load((loader, resources) => {
  console.log(loader);
  console.log(resources);

  // BG
  bg = new PIXI.Sprite(resources.bg_data.texture);
  container_bg.addChild(bg);
  bg.x = 0;
  bg.y = 0;
  bg.interactive = true;
  bg.on("tap", event => {
    console.log("onTap"); // Mobile, Desktop(Touch)
  });
  bg.on("click", event => {
    console.log("click"); // Desktop
  });

  // Filters
  bg.filters = [smokeShader];

  // Text ShokwaveFilter
  let text = new PIXI.Text("Smoke Shader", {
    fontFamily: "Arial",
    fontSize: 30,
    fill: 0xffffff,
    align: "center",
    fontWeight: "bold",
    dropShadow: true,
    dropShadowColor: "#000000",
    trim: true
  });
  container.addChild(text);
  text.x = 260;
  text.y = 30;

  // render start
  ticker.start();

});

/**
 * app rendering
 * @param { number } time
 */
update = (time) => {
  stats.begin();
  count += 0.02;
  smokeShader.uniforms.time = count;
  stats.end();
}