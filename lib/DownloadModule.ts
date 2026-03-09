import { NativeModules, Platform } from 'react-native';

const { DownloadModule } = NativeModules;

export const saveToDownloads = async (fileName: string, content: string): Promise<string> => {
  if (Platform.OS !== 'android') {
    throw new Error('This module is only available on Android');
  }
  
  if (!DownloadModule) {
    throw new Error('DownloadModule is not available');
  }
  
  return DownloadModule.saveToDownloads(fileName, content);
};
