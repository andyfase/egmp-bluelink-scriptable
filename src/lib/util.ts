

interface icon {
  iconName: string,
  color: Color,
  image?: Image
}
const icons : Record<string, icon> = {
  "battery.0": {
    iconName: "battery.0percent",
    color: Color.red(),
  },
  "battery.25": {
    iconName: "battery.25percent",
    color: Color.red(),
  },
  "battery.50": {
    iconName: "battery.50percent",
    color: Color.orange(),
  },
  "battery.75": {
    iconName: "battery.75percent",
    color: Color.green(),
  },
  "battery.100": {
    iconName: "battery.100percent",
    color: Color.green(),
  },
  "charging": {
    iconName: "bolt.fill",
    color: Color.green(),
  },
  "not-charging": {
    iconName: "bolt",
    color: Color.white(),
  },
  "conditioning": {
    iconName: "fan",
    color: Color.green(),
  },
  "not-conditioning": {
    iconName: "fan",
    color: Color.white(),
  },
  "lock": {
    iconName: "lock",
    color: Color.green(),
  },
  "unlocked": {
    iconName: "lock.open",
    color: Color.red()
  },
  "status": {
    iconName: "clock.arrow.trianglehead.2.counterclockwise.rotate.90",
    color: Color.white(),
  }
}

export function getBatteryPercentColor(batteryPercent: number) : Color {
  if (batteryPercent >= 75) {
    return Color.green()
  } else if (batteryPercent >= 50) {
    return Color.orange()
  }
  return Color.red()
}

export async function loadTintedIcons() {
  let loading : Promise<{name: string, image: Image}>[] = []
  for (const [key, value] of Object.entries(icons)) {
      loading.push(tintSFSymbol(key, SFSymbol.named(value.iconName).image, value.color))
  }

  await Promise.all(loading).then((values) => {
    for (const value of values) {
      if (value.name in icons ) {
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
    return (SFSymbol.named(icons[name]?.iconName).image)
  }
  return SFSymbol.named("questionmark.app").image
}

export async function getTintedIconAsync(name: string) : Promise<Image> {

  if (name in icons && icons[name]?.image) {
    return icons[name].image
  }
  if (name in icons && icons[name]?.iconName) {
    return (await tintSFSymbol(icons[name]?.iconName, SFSymbol.named(icons[name].iconName).image, icons[name].color || Color.white())).image
  }
  return SFSymbol.named("questionmark.app").image
}


export function calculateBatteryIcon(
  batteryPercent: number,
  isCharging: boolean
  ): string {
  if (isCharging) {
    return "charging"
  }
  let percentRounded = 0;
  if (batteryPercent > 90) {
    percentRounded = 100;
  } else if (batteryPercent > 60) {
    percentRounded = 75;
  } else if (batteryPercent > 40) {
    percentRounded = 50;
  } else if (batteryPercent > 15) {
    percentRounded = 25;
  }
  return `battery.${percentRounded}`
}


export async function tintSFSymbol(name: string, image: Image, color: Color) {
  let html = `
  <img id="image" src="data:image/png;base64,${Data.fromPNG(image).toBase64String()}" />
  <canvas id="canvas"></canvas>
  `;
  
  let js = `
    let img = document.getElementById("image");
    let canvas = document.getElementById("canvas");
    let color = 0x${color.hex};

    canvas.width = img.width;
    canvas.height = img.height;
    let ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
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
  `;
  
  let wv = new WebView();
  await wv.loadHTML(html);
  let base64 = await wv.evaluateJavaScript(js);
  return {name: name, image: Image.fromData(Data.fromBase64String(base64))}
}