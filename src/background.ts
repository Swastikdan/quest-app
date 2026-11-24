import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { loadConnection } from './api';
import { syncUsage } from './usage';

const task = 'quest-sleep-evidence';
TaskManager.defineTask(task, async () => {
  try {
    const [connection, device] = await Promise.all([loadConnection(), AsyncStorage.getItem('quest.device')]);
    if (connection && device) await syncUsage(connection, device);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function setBackgroundUsage(enabled: boolean) {
  if (enabled) {
    await BackgroundTask.registerTaskAsync(task, { minimumInterval: 15 });
  } else if (await TaskManager.isTaskRegisteredAsync(task)) {
    await BackgroundTask.unregisterTaskAsync(task);
  }
}
