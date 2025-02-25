interface icon {
  iconName: string
  colorDark: Color
  colorLight: Color
  image?: Image
}
const icons: Record<string, icon> = {
  'battery.0': {
    iconName: 'battery.0percent',
    colorDark: Color.red(),
    colorLight: Color.red(),
  },
  'battery.25': {
    iconName: 'battery.25percent',
    colorDark: Color.red(),
    colorLight: Color.red(),
  },
  'battery.50': {
    iconName: 'battery.50percent',
    colorDark: Color.orange(),
    colorLight: Color.orange(),
  },
  'battery.75': {
    iconName: 'battery.75percent',
    colorDark: Color.green(),
    colorLight: Color.green(),
  },
  'battery.100': {
    iconName: 'battery.100percent',
    colorDark: Color.green(),
    colorLight: Color.green(),
  },
  charging: {
    iconName: 'bolt.fill',
    colorDark: Color.green(),
    colorLight: Color.green(),
  },
  'charging-complete': {
    iconName: 'clock',
    colorDark: Color.white(),
    colorLight: Color.black(),
  },
  plugged: {
    iconName: 'powerplug.portrait',
    colorDark: Color.white(),
    colorLight: Color.black(),
  },
  'not-charging': {
    iconName: 'bolt',
    colorDark: Color.white(),
    colorLight: Color.black(),
  },
  'climate-on': {
    iconName: 'fan',
    colorDark: Color.green(),
    colorLight: Color.green(),
  },
  'climate-off': {
    iconName: 'fan',
    colorDark: Color.white(),
    colorLight: Color.black(),
  },
  locked: {
    iconName: 'lock',
    colorDark: Color.green(),
    colorLight: Color.green(),
  },
  unlocked: {
    iconName: 'lock.open',
    colorDark: Color.red(),
    colorLight: Color.red(),
  },
  status: {
    iconName: 'clock.arrow.trianglehead.2.counterclockwise.rotate.90',
    colorDark: Color.white(),
    colorLight: Color.black(),
  },
  settings: {
    iconName: 'gear',
    colorDark: Color.white(),
    colorLight: Color.black(),
  },
  'twelve-volt': {
    iconName: 'minus.plus.batteryblock',
    colorDark: Color.white(),
    colorLight: Color.black(),
  },
}

export const dateStringOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
} as Intl.DateTimeFormatOptions

export function getChargeCompletionString(
  dateFrom: Date,
  minutes: number,
  dayFormat: 'short' | 'long' = 'short',
): string {
  // dateFrom passed by references - hence clone it
  const date = new Date(dateFrom.getTime())
  date.setMinutes(date.getMinutes() + minutes)
  if (new Date().getDate() !== date.getDate()) {
    return date.toLocaleString(undefined, {
      weekday: dayFormat,
      hour: 'numeric',
      minute: 'numeric',
    })
  }
  return date.toLocaleString(undefined, {
    hour: 'numeric',
    minute: 'numeric',
  })
}

export function getBatteryPercentColor(batteryPercent: number): Color {
  if (batteryPercent >= 50) {
    return Color.green()
  } else if (batteryPercent >= 30) {
    return Color.orange()
  }
  return Color.red()
}

export async function loadTintedIcons(darkMode: boolean = true): Promise<void> {
  const loading: Promise<{ name: string; image: Image }>[] = []
  for (const [key, value] of Object.entries(icons)) {
    loading.push(tintSFSymbol(key, SFSymbol.named(value.iconName).image, darkMode ? value.colorDark : value.colorLight))
  }

  await Promise.all(loading).then((values) => {
    for (const value of values) {
      if (value.name in icons) {
        // @ts-ignore
        icons[value.name].image = value.image
      }
    }
  })
}

export function getTintedIcon(name: string): Image {
  if (name in icons && icons[name]?.image) {
    return icons[name].image
  }
  if (name in icons && icons[name]?.iconName) {
    return SFSymbol.named(icons[name]?.iconName).image
  }
  return SFSymbol.named('questionmark.app').image
}

export async function getTintedIconAsync(name: string, darkMode: boolean = true): Promise<Image> {
  if (name in icons && icons[name]?.image) {
    return icons[name].image
  }
  if (name in icons && icons[name]?.iconName) {
    return (
      await tintSFSymbol(
        icons[name]?.iconName,
        SFSymbol.named(icons[name].iconName).image,
        darkMode ? icons[name].colorDark : icons[name].colorLight || Color.white(),
      )
    ).image
  }
  return SFSymbol.named('questionmark.app').image
}

export async function getAngledTintedIconAsync(name: string, color: Color, angle: number): Promise<Image> {
  return (await tintSFSymbol(name, SFSymbol.named(name).image, color, angle)).image
}

export function getChargingIcon(isCharging: boolean, isPluggedIn: boolean): string | undefined {
  return isCharging ? 'charging' : isPluggedIn ? 'plugged' : undefined
}

export function calculateBatteryIcon(batteryPercent: number): string {
  let percentRounded = 0
  if (batteryPercent > 90) {
    percentRounded = 100
  } else if (batteryPercent > 60) {
    percentRounded = 75
  } else if (batteryPercent > 40) {
    percentRounded = 50
  } else if (batteryPercent > 15) {
    percentRounded = 25
  }
  return `battery.${percentRounded}`
}

export async function tintSFSymbol(name: string, image: Image, color: Color, rotateDegree?: number) {
  let rotate = false
  if (rotateDegree) {
    rotate = true
  }
  const html = `
  <img id="image" src="data:image/png;base64,${Data.fromPNG(image).toBase64String()}" />
  <canvas id="canvas"></canvas>
  `

  const js = `
    let img = document.getElementById("image");
    let canvas = document.getElementById("canvas");
    let color = 0x${color.hex};

    canvas.width = img.width;
    canvas.height = img.height;
    let ctx = canvas.getContext("2d");
    if (${rotate}) {
      let width = canvas.width
      let height = canvas.height
      ctx.save()
      var rad = ${rotateDegree} * Math.PI / 180;
      ctx.translate(width / 2, height / 2);
      ctx.rotate(rad); 
      ctx.drawImage(img,width / 2 * (-1),height / 2 * (-1),width,height);
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0);
    } 
    let imgData = ctx.getImageData(0, 0, img.width, img.height);
    // ordered in RGBA format
    let data = imgData.data;
    for (let i = 0; i < data.length; i++) {
      // skip alpha channel
      if (i % 4 === 3) continue;
      // bit shift the color value to get the correct channel
      data[i] = (color >> (2 - i % 4) * 8) & 0xFF
    }
    ctx.putImageData(imgData, 0, 0);

    canvas.toDataURL("image/png").replace(/^data:image\\/png;base64,/, "");
  `

  const wv = new WebView()
  await wv.loadHTML(html)
  const base64 = await wv.evaluateJavaScript(js)
  return { name: name, image: Image.fromData(Data.fromBase64String(base64)) }
}

export async function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    Timer.schedule(milliseconds, false, () => resolve())
  })
}
