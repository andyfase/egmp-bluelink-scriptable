import { BluelinkStatus, BluelinkCar } from './base'

// export function returnMockedCarList(): CarOption[] {
//   return [
//     {
//       vin: '5NMS3CADXLH123456',
//       nickName: 'Mock Ioniq 5',
//       modelName: 'Ioniq 5',
//       modelYear: '2025',
//     },
//   ]
// }

export function returnMockedCar(): BluelinkCar {
  return {
    id: '1234567890',
    vin: '5NMS3CADXLH123456',
    nickName: 'Mock Ioniq 5',
    modelName: 'Ioniq 5',
    modelYear: '2025',
    odometer: 0, // not available here
    modelColour: 'white',
    modelTrim: 'foo',
    europeccs2: 1,
  }
}

export function returnMockedCarStatus(): BluelinkStatus {
  return {
    lastStatusCheck: Date.now(),
    lastRemoteStatusCheck: Date.now(),
    isCharging: false,
    isPluggedIn: false,
    chargingPower: 0,
    remainingChargeTimeMins: 0,
    range: 200,
    soc: 80,
    locked: true,
    climate: false,
    twelveSoc: 90,
    odometer: 10000,
    location: undefined,
    chargeLimit: undefined,
  }
}
