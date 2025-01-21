import { creds } from './index'
import { Bluelink } from './lib/bluelink'
import { getTable, Div,P, Img} from "scriptable-utils";
import { loadTintedIcons, getTintedIcon, calculateBatteryIcon } from "lib/util"

const { present, connect, setState } = getTable<{
  soc: number,
  isCharging: boolean
  range: number
}>({
  name: "Testing",
});

export async function createApp(creds: creds) {
    const bl = new Bluelink({
        username: "foo",
        password: "foo",
        region: "foo"
    })
    await loadTintedIcons()
    
    return present({
      defaultState: { soc: 75, range: 150, isCharging: false },
      render: () => [
            pageTitle(bl),
            batteryStatus(bl),
            pageImage(bl),
            pageIcons(bl)
          ]
      }
    );

}

const pageTitle = connect(({ state: { soc, range } }, bl: Bluelink) => {
  return (Div([
    P(bl.getCarName(), {
      font: n => Font.boldSystemFont(n),
      fontSize: 35,
      align: "left"
    })
  ]))
});

const batteryStatus = connect(({ state: { soc, range } }, bl: Bluelink) => {
  return (
    Div([
    Img(getTintedIcon(calculateBatteryIcon(soc, false)), {align: "left", width: "10%"}),
    P(`${soc.toString()}% (~ ${range} km)`, {align: "left"})
  ]))
})

const pageIcons = connect(({ state: { soc, isCharging } }, bl: Bluelink) => {

  const updatedTime = "20250118165212" + "Z"

  // date conversion
  const df = new DateFormatter()
  df.dateFormat = "yyyyMMddHHmmssZ"
  const lastSeen = df.date(updatedTime)

  return (Div([
    Div([
      Img(getTintedIcon("charging"), {align: "center"}),
      P("Charging at 2.7kw", {align: "left", width: "70%"})
    ], { onTap() {
      setState({
        soc: 15,
        range: 100
      })
    },}),
    Div([
      Img(getTintedIcon("not-conditioning"), {align: "center"}),
      P("Not Conditioning", {align: "left", width: "70%"})
    ]),
    Div([
      Img(getTintedIcon("unlocked"), {align: "center"}),
      P("Car Unlocked", {align: "left", width: "70%"})
    ]),
    Div([
      Img(getTintedIcon("status"), {align: "center"}),
      P(`${lastSeen.toLocaleString()}`, {align: "left", width: "70%"})
    ]),
  ]))
});

function pageImage (bl: Bluelink) {
  const appIcon = Image.fromData(Data.fromBase64String(bl.getCarImage()))
  appIcon.size.width = 500
  appIcon.size.height = 90
  return (Div([Img(appIcon)],{ height: 150 }))
};
