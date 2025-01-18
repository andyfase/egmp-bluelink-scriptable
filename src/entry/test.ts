
const isDev = true

// Widget Config
const IMAGE_ANGLE = "0"; // Possible values 0,1,2,3,4,5
const RANGE_IN_MILES = false; // true
const LAST_SEEN_RELATIVE_DATE = false; // true
const MIN_SOC_GREEN = 60;
const MIN_SOC_ORANGE = 30;

const DARK_MODE = Device.isUsingDarkAppearance(); // or set manually to (true or false)
const DARK_BG_COLOR = "000000";
const LIGHT_BG_COLOR = "FFFFFF";


interface FullVehicleStatus {
    soc: number,
    name: string,
    icon: string,
}

;(async () => {
//   let items = await loadItems()
  let data : FullVehicleStatus = {
    soc: 97,
    name: "Andys Car",
    icon: "https://mybluelink.ca/vin/2023/09/049821b6fd9e4e4b81f5f791d8fb0519_1695445819406.png"
  }

  if (config.runsInWidget || isDev) {
    let widget = await createWidget(data)
    Script.setWidget(widget)
    Script.complete()
  } else {
    Safari.open(data.icon)
  }
})()

async function createWidget(data: FullVehicleStatus) {
  const batteryPercent = parseInt(batteryData.batteryChargeLevelPercentage);
  const isCharging = batteryData.chargingStatus === "CHARGING_STATUS_CHARGING";
  const remainingChargingTime = batteryData.estimatedChargingTimeToFullMinutes;
  const rangeKm = batteryData.estimatedDistanceToEmptyKm;
  const rangeMiles = batteryData.estimatedDistanceToEmptyMiles;
  const isChargingDone = batteryData.chargingStatus === "CHARGING_STATUS_DONE";
  const isConnected =
    batteryData.chargerConnectionStatus ===
    "CHARGER_CONNECTION_STATUS_CONNECTED";
  const chargingAmps = batteryData.chargingCurrentAmps ?? 0;
  const chargingWatts = batteryData.chargingPowerWatts ?? 0;
  const chargingKw = parseInt(chargingWatts / 1000);

  // Prepare image
  if (!vehicle.content.images.studio.angles.includes(IMAGE_ANGLE)) {
    throw new Error(
      `IMG_ANGLE ${IMAGE_ANGLE} is not in ${vehicle.content.images.studio.angles}`
    );
  }
  const imgUrl = `${
    vehicle.content.images.studio.url
  }&angle=${IMAGE_ANGLE}&bg=${
    DARK_MODE ? DARK_BG_COLOR : LIGHT_BG_COLOR
  }&width=600`;

  const appIcon = await loadImage(POLESTAR_ICON);
  const title = VEHICLE_NAME ?? vehicle.content.model.name;
  const widget = new ListWidget();
  widget.url = "polestar-explore://";
  const mainStack = widget.addStack();
  mainStack.layoutVertically();

  // Add background color
  widget.backgroundColor = DARK_MODE
    ? new Color(DARK_BG_COLOR)
    : new Color(LIGHT_BG_COLOR);

  // Show app icon and title
  mainStack.addSpacer();
  const titleStack = mainStack.addStack();
  const titleElement = titleStack.addText(title);
  titleElement.textColor = DARK_MODE ? Color.white() : Color.black();
  titleElement.textOpacity = 0.7;
  titleElement.font = Font.mediumSystemFont(18);
  titleStack.addSpacer();
  const appIconElement = titleStack.addImage(appIcon);
  appIconElement.imageSize = new Size(30, 30);
  appIconElement.cornerRadius = 4;
  mainStack.addSpacer();

  // Center Stack
  const contentStack = mainStack.addStack();
  const carImage = await loadImage(imgUrl);
  const carImageElement = contentStack.addImage(carImage);
  carImageElement.imageSize = new Size(150, 90);
  contentStack.addSpacer();

  // Battery Info
  const batteryInfoStack = contentStack.addStack();
  batteryInfoStack.layoutVertically();
  batteryInfoStack.addSpacer();

  // Range
  const rangeStack = batteryInfoStack.addStack();
  rangeStack.addSpacer();
  const rangeText = RANGE_IN_MILES ? `${rangeMiles} mi` : `${rangeKm} km`;
  const rangeElement = rangeStack.addText(rangeText);
  rangeElement.font = Font.mediumSystemFont(20);
  rangeElement.textColor = DARK_MODE ? Color.white() : Color.black();
  rangeElement.rightAlignText();
  batteryInfoStack.addSpacer();

  // Battery Percent Value
  const batteryPercentStack = batteryInfoStack.addStack();
  batteryPercentStack.addSpacer();
  batteryPercentStack.centerAlignContent();
  const { batteryIcon, batteryIconColor } = getBatteryIcon(
    batteryPercent,
    isConnected,
    isCharging,
    isChargingDone
  );
  const batterySymbolElement = batteryPercentStack.addImage(batteryIcon.image);
  batterySymbolElement.imageSize = new Size(25, 25);
  batterySymbolElement.tintColor = batteryIconColor;
  batteryPercentStack.addSpacer(8);

  const batteryPercentText = batteryPercentStack.addText(`${batteryPercent} %`);
  batteryPercentText.textColor = getBatteryPercentColor(batteryPercent);
  batteryPercentText.font = Font.boldSystemFont(20);

  if (isCharging) {
    const batteryChargingTimeStack = batteryInfoStack.addStack();
    batteryChargingTimeStack.addSpacer();
    const remainingChargeTimeHours = parseInt(remainingChargingTime / 60);
    const remainingChargeTimeMinsRemainder = remainingChargingTime % 60;
    const chargingTimeElement = batteryChargingTimeStack.addText(
      `${chargingKw} kW  -  ${remainingChargeTimeHours}h ${remainingChargeTimeMinsRemainder}m`
    );
    chargingTimeElement.font = Font.mediumSystemFont(14);
    chargingTimeElement.textOpacity = 0.9;
    chargingTimeElement.textColor = DARK_MODE ? Color.white() : Color.black();
    chargingTimeElement.rightAlignText();
  }
  batteryInfoStack.addSpacer();

  // Footer
  const footerStack = mainStack.addStack();

  // Add odometer
  const odometerText = RANGE_IN_MILES
    ? `${parseInt(odometerData.odometerMeters / 1609.344).toLocaleString()} mi`
    : `${parseInt(odometerData.odometerMeters / 1000).toLocaleString()} km`;
  const odometerElement = footerStack.addText(odometerText);
  odometerElement.font = Font.mediumSystemFont(10);
  odometerElement.textColor = DARK_MODE ? Color.white() : Color.black();
  odometerElement.textOpacity = 0.5;
  odometerElement.minimumScaleFactor = 0.5;
  odometerElement.leftAlignText();
  footerStack.addSpacer();

  // Add last seen indicator
  const lastSeenDate = new Date(batteryData.eventUpdatedTimestamp.iso);
  const lastSeenText = lastSeenDate.toLocaleString();
  let lastSeenElement;
  if (LAST_SEEN_RELATIVE_DATE) {
    lastSeenElement = footerStack.addDate(lastSeenDate);
    lastSeenElement.applyRelativeStyle();
  } else {
    lastSeenElement = footerStack.addText(lastSeenText);
  }
  lastSeenElement.font = Font.mediumSystemFont(10);
  lastSeenElement.textOpacity = 0.5;
  lastSeenElement.textColor = DARK_MODE ? Color.white() : Color.black();
  lastSeenElement.minimumScaleFactor = 0.5;
  lastSeenElement.rightAlignText();

  mainStack.addSpacer();

  return widget;
}
  
// async function bluelink() : Promise<FullVehicleStatus|undefined> {
//     const client = new BlueLinky({
//         username: 'andrewfase@gmail.com',
//         password: 'g4rf1elD!',
//         brand: 'hyundai',
//         region: 'CA',
//         pin: '3895'
//     });
//     await client.login();
//     const vehicles = await client.getVehicles();
//     const vehicle = vehicles[0];
//     const status = await vehicle!.fullStatus({parsed: true, refresh: false});
//     if (!status || status === null) {
//         return undefined
//     }
//     return status
// }


// async function loadItems() {
//   let url = "https://macstories.net/feed/json"
//   let req = new Request(url)
//   let json = await req.loadJSON()
//   return json.items || [] as item[]
// }

// function extractImageURL(item) {
//   let regex = /<img src="(.*)" alt="/
//   let html = item["content_html"]
//   let matches = html.match(regex)
//   if (matches && matches.length >= 2) {
//     return matches[1]
//   } else {
//     return null
//   }
// }

// function decode(str) {
//   let regex = /&#(\d+);/g
//   return str.replace(regex, (match, dec) => {
//     return String.fromCharCode(dec)
//   })
// }