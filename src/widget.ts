import { Bluelink } from './lib/bluelink'
import { getTintedIconAsync, getBatteryPercentColor, calculateBatteryIcon } from './lib/util' 

// Widget Config
const RANGE_IN_MILES = false; // true

const DARK_MODE = true // Device.isUsingDarkAppearance(); // or set manually to (true or false)
const DARK_BG_COLOR = "000000";
const LIGHT_BG_COLOR = "FFFFFF";



export async function createWidget() {
    const bl = new Bluelink({
        username: "foo",
        password: "foo",
        region: "foo"
    })

    // Prepare image
    const appIcon = Image.fromData(Data.fromBase64String(bl.getCarImage()))
    const title = bl.getCarName()
    
    const widget = new ListWidget();
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
    const carImageElement = contentStack.addImage(appIcon);
    carImageElement.imageSize = new Size(150, 90);
    contentStack.addSpacer();
  
    // Battery Info
    const batteryInfoStack = contentStack.addStack();
    batteryInfoStack.layoutVertically();
    batteryInfoStack.addSpacer();
  
    // Range
    const rangeStack = batteryInfoStack.addStack();
    rangeStack.addSpacer();
    const rangeText = "100km"
    const rangeElement = rangeStack.addText(rangeText);
    rangeElement.font = Font.mediumSystemFont(20);
    rangeElement.textColor = DARK_MODE ? Color.white() : Color.black();
    rangeElement.rightAlignText();
    batteryInfoStack.addSpacer();

    //temp test variables
    const isCharging = true
    const batteryPercent = 50
    const remainingChargingTime = 1200
    const chargingKw = "2.7"
    const odometer = 45000
    const updatedTime = "20250118165212" + "Z"

    // date conversion
    const df = new DateFormatter()
    df.dateFormat = "yyyyMMddHHmmssZ"
    const lastSeen = df.date(updatedTime)

    // Battery Percent Value
    const batteryPercentStack = batteryInfoStack.addStack();
    batteryPercentStack.addSpacer();
    batteryPercentStack.centerAlignContent();
    const image = await getTintedIconAsync(calculateBatteryIcon(batteryPercent, isCharging));
    const batterySymbolElement = batteryPercentStack.addImage(image);
    batterySymbolElement.imageSize = new Size(25, 25);
    batteryPercentStack.addSpacer(8);
  
    const batteryPercentText = batteryPercentStack.addText(`${batteryPercent.toString()}%`);
    batteryPercentText.textColor = getBatteryPercentColor(50);
    batteryPercentText.font = Font.boldSystemFont(20);
  
    if (isCharging) {
      const batteryChargingTimeStack = batteryInfoStack.addStack();
      batteryChargingTimeStack.addSpacer();
      const remainingChargeTimeHours = Number((remainingChargingTime / 60)).toString();
      const remainingChargeTimeMinsRemainder = Number(remainingChargingTime % 60);
      const chargingTimeElement = batteryChargingTimeStack.addText(
        `${chargingKw} kW  - ${remainingChargeTimeHours}h ${remainingChargeTimeMinsRemainder}m`
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
      ? `${Number(odometer / 1.6).toString()} mi`
      : `${Number(odometer).toString()} km`;
    const odometerElement = footerStack.addText(odometerText);
    odometerElement.font = Font.mediumSystemFont(10);
    odometerElement.textColor = DARK_MODE ? Color.white() : Color.black();
    odometerElement.textOpacity = 0.5;
    odometerElement.minimumScaleFactor = 0.5;
    odometerElement.leftAlignText();
    footerStack.addSpacer();

    // Add last seen indicator
    const lastSeenElement = footerStack.addText(lastSeen.toLocaleString() || "last update unknown");
    lastSeenElement.font = Font.mediumSystemFont(10);
    lastSeenElement.textOpacity = 0.5;
    lastSeenElement.textColor = DARK_MODE ? Color.white() : Color.black();
    lastSeenElement.minimumScaleFactor = 0.5;
    lastSeenElement.rightAlignText();
  
    mainStack.addSpacer();
  
    return widget;
  }