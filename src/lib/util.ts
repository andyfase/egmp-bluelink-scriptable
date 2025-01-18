
const MIN_SOC_GREEN = 60;
const MIN_SOC_ORANGE = 30;

export function getBatteryIcon(
  batteryPercent: number,
  isConnected: boolean,
  isCharging: boolean,
  isChargingDone: boolean
  ) {
  let icon;
  let iconColor;
  if (isCharging || isChargingDone) {
    icon = isCharging
      ? SFSymbol.named("bolt.fill")
      : SFSymbol.named("bolt.badge.checkmark.fill");
    iconColor = Color.green();
  } else if (isConnected) {
  icon = SFSymbol.named("bolt.badge.xmark");
  iconColor = Color.red();
  } else {
    let percentRounded = 0;
    iconColor = Color.red();
    if (batteryPercent > 90) {
      percentRounded = 100;
    } else if (batteryPercent > 60) {
      percentRounded = 75;
    } else if (batteryPercent > 40) {
      percentRounded = 50;
    } else if (batteryPercent > 10) {
      percentRounded = 25;
    }
    iconColor = getBatteryPercentColor(batteryPercent);
    icon = SFSymbol.named(`battery.${percentRounded}`);
  }
  return { batteryIcon: icon, batteryIconColor: iconColor };
  }

export function getBatteryPercentColor(percent: number) {
  if (percent > MIN_SOC_GREEN) {
    return Color.green();
  } else if (percent > MIN_SOC_ORANGE) {
    return Color.orange();
  } else {
    return Color.red();
  }
}