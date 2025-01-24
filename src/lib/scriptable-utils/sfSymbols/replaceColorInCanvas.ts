// https://talk.automators.fm/t/define-the-color-of-a-sf-symbols-in-drawcontext/9897/11
//
// I haven't dug too far into the code so it may be able to be improved. I found
// settings that work pretty well through experimentation.

import { clamp, ExcludeFalsy, isNumber, isString } from '../common'

/**
 * @param {Image} image The image from the SFSymbol
 * @param {Color} newColor The color it should be tinted with
 * @param {object} [options]
 * @param {number} [options.hueMargin] Maximum hue difference between the color
 * to replace and the color found in the image. Defaults to `10`, range: `0` to
 * `180`. Colors are never separated by more than 180°.
 * @param {number} [options.lightnessMargin] Maximum lightness difference
 * between the color to replace and the color found in the image. Defaults to
 * `0.4`, range: `0` to `1`.
 * @param {Color | number | (Color | number)[]} [options.currentColor] The color
 * that should be replaced. If not provided, the most prominent color will be
 * replaced. Can be a Color instance or a number specifying the hue (0 to 360)
 * or an array of those to replace multiple colors at once. Common hues
 * (https://hslpicker.com):
 * * `0` - red
 * * `30` - orange/brown
 * * `60` - yellow
 * * `120` - green
 * * `180` - cyan
 * * `210` - iOS buttons blue
 * * `240` - blue
 * * `300` - magenta
 * * `360` - red
 * @param {boolean | { lower?: number, upper?: number }}
 * [options.replaceSaturation] Whether or not to use the saturation from the
 * replacement color. You can also specify a cutoff between 0 and 1 with `lower`
 * and `upper`. Every value between them will be replaced. `lower` defaults to 0
 * and `upper` to 1 if one of them is provided. Gray colors have saturation <
 * 0.2, set this to `{ upper: 0.2 }` to replace them with non-gray colors.
 * @param {boolean | { lower?: number, upper?: number }}
 * [options.replaceLightness] Whether or not to use the lightness from the
 * replacement color. You can also specify a cutoff between 0 and 1 with `lower`
 * and `upper`. Every value between them will be replaced. `lower` defaults to 0
 * and `upper`to 1 if one of them is provided. Black = 0, full color = 0.5,
 * white = 1.
 * @param {boolean} [options.noWarnings] Turn warnings off. These are printed to
 * the console when you try to replace black, gray or white colors without
 * specifying `replaceSaturation` and `replaceLightness`.
 */

type Bounds = { lower?: number; upper?: number }

type Opts = {
  hueMargin: number
  lightnessMargin: number
  currentColor?: Color | number | (Color | number | undefined)[]
  replaceSaturation: boolean | Bounds
  replaceLightness: boolean | Bounds
  noWarnings: boolean
}

const getSanitizeBoundsOptParsedVal = (val: boolean | Bounds) => {
  if (!val) return false
  if (val === true) return {}
  return val
}

const sanitizeBoundsOpt = (val: boolean | Bounds) => {
  const parsedVal = getSanitizeBoundsOptParsedVal(val)
  if (!parsedVal) return parsedVal
  const { lower, upper } = parsedVal
  return {
    lower: clamp(isNumber(lower) ? lower : 0, 0, 1),
    upper: clamp(isNumber(upper) ? upper : 1, 0, 1),
  }
}

const parseOpts = ({
  hueMargin,
  lightnessMargin,
  currentColor,
  replaceSaturation,
  replaceLightness,
  ...rest
}: Opts) => {
  return {
    hueMargin: clamp(hueMargin, 0, 180),
    lightnessMargin: clamp(lightnessMargin, 0, 1),
    currentColor: (Array.isArray(currentColor) ? currentColor : [currentColor]).filter(ExcludeFalsy),
    replaceSaturation: sanitizeBoundsOpt(replaceSaturation),
    replaceLightness: sanitizeBoundsOpt(replaceLightness),
    ...rest,
  }
}

type ParsedOpts = ReturnType<typeof parseOpts>

const getJS = (
  newColor: Color,
  { currentColor, noWarnings, replaceLightness, replaceSaturation, hueMargin, lightnessMargin }: ParsedOpts,
) => `
function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return ({
        h: h,
        s: s,
        l: l,
    });
}


function hslToRgb(h, s, l) {
    var r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return ({
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    });
}

function toHex(r, g, b) {
  return "0x" + r.toString(16) + g.toString(16) + b.toString(16);
}


let img = document.getElementById("image");
let canvas = document.getElementById("canvas");
let color = 0x${newColor.hex};
let oldColor = ${JSON.stringify(currentColor.map((c) => (c instanceof Color ? '"0x' + c.hex + '"' : c)))};
let targetHsl = rgbToHsl(
  (color >> 16) & 0xFF,
  (color >> 8) & 0xFF,
  color & 0xFF,
);
targetHsl.h *= 360;
let oldHsl = oldColor.map(
  (c) => {
    if (typeof c === "string") {
      c = parseInt(c);
      const hsl = rgbToHsl(
        (c >> 16) & 0xFF,
        (c >> 8) & 0xFF,
        c & 0xFF,
      );
      hsl.h *= 360;
      return hsl;
    } else {
      return {
        h: c,
        s: 1,
        l: 0.5,
      };
    }
  }
);
const hasOldColor = oldHsl.length > 0;

canvas.width = img.width;
canvas.height = img.height;
let ctx = canvas.getContext("2d");
ctx.drawImage(img, 0, 0);
let imgData = ctx.getImageData(0, 0, img.width, img.height);
// ordered in RGBA format
let data = imgData.data;

// order: hue saturation luminance alpha (alpha is not filled)
const hslData = new Array(data.length);
const colorMap = new Map();
for (let i = 0; i < data.length; i += 4) {
  let hsl = rgbToHsl(data[i + 0], data[i + 1], data[i + 2]);
  hsl.h *= 360;
  hslData[i + 0] = hsl.h;
  hslData[i + 1] = hsl.s;
  hslData[i + 2] = hsl.l;
  const hue = Math.round(hsl.h);

  if (!hasOldColor && data[i + 3] > 0) {
    const current = colorMap.has(hue) ? colorMap.get(hue) : 0;
    colorMap.set(hue, current + 1);
  }
}

let maxHue = 0;
let maxHueCount = 0;
if (!hasOldColor) {
  for (const [hue, count] of colorMap) {
    if (count > maxHueCount) {
      maxHue = hue;
      maxHueCount = count;
    }
  }
}

let warnedAboutGray = ${noWarnings};
let warnedAboutBlack = ${noWarnings};
const satBounds = ${JSON.stringify(replaceSaturation)};
const lightBounds = ${JSON.stringify(replaceLightness)};
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] === 0) continue;
  let diff = {
    h: 0,
    s: 0,
    l: 0,
  };
  if (hasOldColor) {
    diff = oldHsl
      .map((hsl) => {
        const ret = {
          h: Math.abs(hslData[i] - hsl.h),
          s: Math.abs(hslData[i + 1] - hsl.s),
          l: Math.abs(hslData[i + 2] - hsl.l),
        };
        if (ret.h > 180) ret.h = 360 - ret.h;
        return ret;
      })
      .reduce((prev, cur) => !prev ? cur : prev.h < cur.h ? prev : cur);
  } else {
    diff.h = Math.abs(hslData[i] - maxHue);
    if (diff.h > 180) {
      diff.h = 360 - diff.h;
    }
  }
  if (diff.h < ${hueMargin} && diff.l < ${lightnessMargin}) {
    let sat = hslData[i + 1];
    if (satBounds && sat >= satBounds.lower && sat <= satBounds.upper) {
      sat = targetHsl.s;
    } else if (!satBounds && sat < 0.1 && !warnedAboutGray) {
      warnedAboutGray = true;
      logWarning(
        "[replaceColor()] You tried replacing a grayish color without"
        + " specifying that its saturation should also be replaced."
      );
    }
    let light = hslData[i + 2];
    if (
      lightBounds
      && light >= lightBounds.lower
      && light <= lightBounds.upper
    ) {
      light = targetHsl.l;
    } else if (
      !lightBounds
      && (light <= 0.1 || light >= 0.9)
      && !warnedAboutBlack
    ) {
      warnedAboutBlack = true;
      logWarning(
        "[replaceColor()] You tried replacing a black or white color without"
        + " specifying that its lightness should also be replaced. You"
        + " should also specify that its saturation should be replaced, if"
        + " you haven't done so already."
      );
    }
    const rgb = hslToRgb(targetHsl.h / 360, sat, light);
    data[i + 0] = rgb.r;
    data[i + 1] = rgb.g;
    data[i + 2] = rgb.b;
  }
}
ctx.putImageData(imgData, 0, 0);
canvas.toDataURL("image/png").replace(/^data:image\\/png;base64,/, "");
`

//
//
//

const flavors = {
  /** Landed on these through experimentation. */
  sfSymbol: {
    hueMargin: 130,
    lightnessMargin: 0.4,
    currentColor: undefined,
    replaceSaturation: true,
    replaceLightness: true,
    noWarnings: true,
  } as Opts,
}

//

export default async (image: Image, newColor: Color, flavor: keyof typeof flavors = 'sfSymbol') => {
  const html = `
  <img id="image" src="data:image/png;base64,${Data.fromPNG(image).toBase64String()}" />
  <canvas id="canvas"></canvas>
  `

  const js = getJS(newColor, parseOpts(flavors[flavor]))
  const w = new WebView()
  await w.loadHTML(html)
  const base64 = (await w.evaluateJavaScript(js)) as unknown
  if (!isString(base64)) throw new Error('Base64 conversion result is not a string')
  return Image.fromData(Data.fromBase64String(base64))
}
