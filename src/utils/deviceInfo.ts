import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';
import { RapideTicketConfig } from '../types';

export const getDeviceMetadata = async () => {
  return {
    version: await DeviceInfo.getVersion(),
    os: DeviceInfo.getSystemName(),
    osVersion: await DeviceInfo.getSystemVersion(),
    model: DeviceInfo.getModel(),
  };
};

/**
 * Enriches the user description with a technical Markdown block matching
 * the Flutter SDK format (converted to ADF by the Jira backend).
 *
 * Format:
 * {userDescription}
 *
 * ---
 *
 * ### 📋 Feedback context
 * - **Environment:** production
 * - **Platform:** IOS
 * - **Device:** iPhone 15 Pro · iOS 17.2
 * - **Build number:** 42
 * - **Build version:** 1.4.0
 * - **App name:** My App
 */
export const enrichDescriptionWithMetadata = async (
  userDescription: string,
  config: RapideTicketConfig,
): Promise<string> => {
  const base = userDescription.trim() || '(No text — see attached screenshot.)';
  const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
  const flavor = config.flavor?.trim() || 'production';

  let deviceLine = '';
  let buildNumber = '';
  let buildVersion = '';
  let appName = '';

  try {
    const model = DeviceInfo.getModel();
    const systemName = DeviceInfo.getSystemName();
    const systemVersion = await DeviceInfo.getSystemVersion();
    deviceLine = `${model} · ${systemName} ${systemVersion}`;
  } catch {
    deviceLine = `${Platform.OS} device`;
  }

  try {
    buildNumber = await DeviceInfo.getBuildNumber();
    buildVersion = await DeviceInfo.getVersion();
    appName = await DeviceInfo.getApplicationName();
  } catch {
    // ignore
  }

  const meta = [
    `- **Environment:** ${flavor}`,
    `- **Platform:** ${platform}`,
    deviceLine ? `- **Device:** ${deviceLine}` : null,
    buildNumber ? `- **Build number:** ${buildNumber}` : null,
    buildVersion ? `- **Build version:** ${buildVersion}` : null,
    appName ? `- **App name:** ${appName}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `${base}\n\n---\n\n### 📋 Feedback context\n\n${meta}`;
};
