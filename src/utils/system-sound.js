import { NativeModules } from 'react-native';

const { SystemSound } = NativeModules;

class SystemSoundManager {
  async playDefaultRingtone() {
    try {
      if (!SystemSound) {
        console.error('SystemSound native module not found');
        return false;
      }

      return await SystemSound.playDefaultRingtone();
    } catch (error) {
      console.error('Error playing default ringtone:', error);
      return false;
    }
  }

  async stopRingtone() {
    try {
      if (!SystemSound) {
        console.error('SystemSound native module not found');
        return false;
      }

      return await SystemSound.stopRingtone();
    } catch (error) {
      console.error('Error stopping ringtone:', error);
      return false;
    }
  }
}

export default new SystemSoundManager();
