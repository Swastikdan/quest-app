import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export const UPDATE_REPOSITORY = 'Swastikdan/quest-app';
const MANIFEST_URL = `https://github.com/${UPDATE_REPOSITORY}/releases/latest/download/latest.json`;

export interface UpdateInfo {
  version: string;
  notes: string;
  apk_url: string;
}

export function currentVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

function newer(remote: string, current: string): boolean {
  const a = remote.replace(/^v/i, '').split('.').map((part) => Number(part) || 0);
  const b = current.replace(/^v/i, '').split('.').map((part) => Number(part) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

export async function checkForUpdate(): Promise<{
  supported: boolean;
  available: boolean;
  current: string;
  info?: UpdateInfo;
}> {
  const current = currentVersion();
  if (Platform.OS !== 'android') return { supported: false, available: false, current };
  const response = await fetch(MANIFEST_URL, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) {
    throw new Error('No published build found yet. Run the GitHub release workflow first.');
  }
  const data = await response.json() as Partial<UpdateInfo>;
  if (!data.version || !data.apk_url) throw new Error('The update feed is missing a version or APK link.');
  return {
    supported: true,
    available: newer(data.version, current),
    current,
    info: {
      version: data.version,
      notes: data.notes ?? '',
      apk_url: data.apk_url
    }
  };
}

export async function openInstallSettings() {
  try {
    await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
      data: 'package:com.gathin.quest'
    });
  } catch {
    await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES');
  }
}

export async function downloadAndInstall(info: UpdateInfo): Promise<void> {
  if (Platform.OS !== 'android') throw new Error('In-app APK updates are Android-only.');
  const destination = new File(Paths.cache, `quest-${info.version}.apk`);
  if (destination.exists) destination.delete();
  const file = await File.downloadFileAsync(info.apk_url, destination);
  const uri = await getContentUriAsync(file.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: uri,
    type: 'application/vnd.android.package-archive',
    flags: 1
  });
}
