import DeviceInfo from 'react-native-device-info';

export const getDeviceMetadata = async () => {
  return {
    version: DeviceInfo.getVersion(),
    os: DeviceInfo.getSystemName(),
    osVersion: DeviceInfo.getSystemVersion(),
    model: DeviceInfo.getModel(),
  };
};
