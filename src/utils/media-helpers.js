import { Platform, Alert } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import {errorCodes, isErrorWithCode, pick, types} from '@react-native-documents/picker';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';

// Initialize audio recorder player
const audioRecorderPlayer = new AudioRecorderPlayer();
let audioPlayer = null;
let recordingStartTime = 0;

// Check camera permission
const checkCameraPermission = async () => {
  if (Platform.OS === 'android') {
    const result = await check(PERMISSIONS.ANDROID.CAMERA);
    if (result !== RESULTS.GRANTED) {
      const requestResult = await request(PERMISSIONS.ANDROID.CAMERA);
      if (requestResult !== RESULTS.GRANTED) {
        Alert.alert(
          "Permission Required",
          "Camera permission is needed to take photos. Please enable it in app settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => openSettings() }
          ]
        );
        return false;
      }
      return true;
    }
    return true;
  } else {
    const result = await check(PERMISSIONS.IOS.CAMERA);
    if (result !== RESULTS.GRANTED) {
      const requestResult = await request(PERMISSIONS.IOS.CAMERA);
      if (requestResult !== RESULTS.GRANTED) {
        Alert.alert(
          "Permission Required",
          "Camera permission is needed to take photos. Please enable it in app settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => openSettings() }
          ]
        );
        return false;
      }
      return true;
    }
    return true;
  }
};

// Check photo library permission
const checkPhotoLibraryPermission = async () => {
  if (Platform.OS === 'android') {
    // For Android 13+ (API 33+)
    if (parseInt(Platform.Version, 10) >= 33) {
      const photoPermission = await check(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
      if (photoPermission !== RESULTS.GRANTED) {
        const requestResult = await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
        if (requestResult !== RESULTS.GRANTED) {
          Alert.alert(
            "Permission Required",
            "Storage permission is needed to access media. Please enable it in app settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => openSettings() }
            ]
          );
          return false;
        }
        return true;
      }
      return true;
    }
    // For Android 12 and below
    else {
      const result = await check(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
      if (result !== RESULTS.GRANTED) {
        const requestResult = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
        if (requestResult !== RESULTS.GRANTED) {
          Alert.alert(
            "Permission Required",
            "Storage permission is needed to access media. Please enable it in app settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => openSettings() }
            ]
          );
          return false;
        }
        return true;
      }
      return true;
    }
  } else {
    const result = await check(PERMISSIONS.IOS.PHOTO_LIBRARY);
    if (result !== RESULTS.GRANTED) {
      const requestResult = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      if (requestResult !== RESULTS.GRANTED) {
        Alert.alert(
          "Permission Required",
          "Photo library permission is needed to select images. Please enable it in app settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => openSettings() }
          ]
        );
        return false;
      }
      return true;
    }
    return true;
  }
};

// Check microphone permission
const checkMicrophonePermission = async () => {
  if (Platform.OS === 'android') {
    const result = await check(PERMISSIONS.ANDROID.RECORD_AUDIO);
    if (result !== RESULTS.GRANTED) {
      const requestResult = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
      if (requestResult !== RESULTS.GRANTED) {
        Alert.alert(
          "Permission Required",
          "Microphone permission is needed to record audio. Please enable it in app settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => openSettings() }
          ]
        );
        return false;
      }
      return true;
    }
    return true;
  } else {
    const result = await check(PERMISSIONS.IOS.MICROPHONE);
    if (result !== RESULTS.GRANTED) {
      const requestResult = await request(PERMISSIONS.IOS.MICROPHONE);
      if (requestResult !== RESULTS.GRANTED) {
        Alert.alert(
          "Permission Required",
          "Microphone permission is needed to record audio. Please enable it in app settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => openSettings() }
          ]
        );
        return false;
      }
      return true;
    }
    return true;
  }
};

// Take photo with camera
export const takePhoto = async () => {
  const hasPermission = await checkCameraPermission();
  if (!hasPermission) {
    return null;
  }

  const options = {
    mediaType: 'photo',
    includeBase64: false,
    maxHeight: 2000,
    maxWidth: 2000,
    saveToPhotos: true,
  };

  try {
    const result = await launchCamera(options);

    if (result.didCancel) {
      return null;
    }

    if (result.errorCode) {
      throw new Error(result.errorMessage);
    }

    if (result.assets && result.assets.length > 0) {
      const capturedImage = result.assets[0];
      return {
        uri: capturedImage.uri,
        type: capturedImage.type,
        name: capturedImage.fileName || `photo-${Date.now()}.jpg`,
      };
    }

    return null;
  } catch (error) {
    console.error('Error taking photo:', error);
    throw error;
  }
};

// Pick document
export const pickMultipleDocuments = async () => {
  const hasPermission = await checkPhotoLibraryPermission();
  if (!hasPermission) {
    return null;
  }

  try {
    // Enable multiple selection with the allowMultiSelection option
    const results = await pick({
      type: [types.allFiles],
      allowMultiSelection: true, // Enable multiple selection
    });

    // Return the array of documents with consistent property names
    return results.map(doc => ({
      uri: doc.uri,
      type: doc.type,
      name: doc.name,
      fileName: doc.name,
      size: doc.size,
    }));
  } catch (error) {
    if (isErrorWithCode(error, errorCodes.OPERATION_CANCELED)) {
      return null;
    }
    console.error('Error picking document:', error);
    throw error;
  }
};
// Start audio recording
export const startAudioRecording = async () => {
  const hasPermission = await checkMicrophonePermission();
  if (!hasPermission) {
    return null;
  }

  try {
    const path = Platform.OS === 'ios'
      ? `${RNFS.DocumentDirectoryPath}/recording-${Date.now()}.m4a`
      : `${RNFS.CachesDirectoryPath}/recording-${Date.now()}.mp3`;

    recordingStartTime = Date.now();
    const result = await audioRecorderPlayer.startRecorder(path);
    console.log('Recording started at path:', result);
    return path;
  } catch (error) {
    console.error('Error starting audio recording:', error);
    throw error;
  }
};

// Stop audio recording
export const stopAudioRecording = async (discard = false) => {
  try {
    const result = await audioRecorderPlayer.stopRecorder();
    console.log('Recording stopped, file saved at:', result);

    if (discard) {
      // Delete the file if we're discarding the recording
      try {
        await RNFS.unlink(result);
        console.log('Discarded recording file deleted');
      } catch (err) {
        console.error('Error deleting discarded recording:', err);
      }
      return null;
    }

    return {
      uri: result,
      type: Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp3',
      name: `recording-${Date.now()}.${Platform.OS === 'ios' ? 'm4a' : 'mp3'}`,
      duration: Math.round((Date.now() - recordingStartTime) / 1000),
    };
  } catch (error) {
    console.error('Error stopping audio recording:', error);
    throw error;
  }
};

// Get audio recording duration
export const getAudioRecordingDuration = () => {
  if (recordingStartTime === 0) return 0;
  return Math.round((Date.now() - recordingStartTime) / 1000);
};

// Play audio
export const playAudio = async (uri) => {
  try {
    await stopAudio();
    audioPlayer = audioRecorderPlayer;
    await audioPlayer.startPlayer(uri);

    audioPlayer.addPlayBackListener((e) => {
      if (e.currentPosition === e.duration) {
        audioPlayer.stopPlayer();
        audioPlayer.removePlayBackListener();
      }
    });

    return true;
  } catch (error) {
    console.error('Error playing audio:', error);
    throw error;
  }
};

// Stop audio playback
export const stopAudio = async () => {
  try {
    if (audioPlayer) {
      await audioPlayer.stopPlayer();
      audioPlayer.removePlayBackListener();
    }
    return true;
  } catch (error) {
    console.error('Error stopping audio playback:', error);
    // Don't throw here, just log the error
    return false;
  }
};
export const pickMultipleMedia = async (maxImages = 10) => {
  try {
    // Implementation will depend on your image picker library
    // For example, with react-native-image-picker:
    const options = {
      mediaType: 'mixed',
      selectionLimit: maxImages, // 0 means unlimited, but we'll handle the limit ourselves
      includeBase64: false,
      maxHeight: 1200,
      maxWidth: 1200,
      quality: 0.8,
      multiple: true,
    };

    const result = await launchImageLibrary(options);

    if (result.didCancel) {
      return null;
    }

    if (result.errorCode) {
      throw new Error(`Image picker error: ${result.errorMessage}`);
    }

    // Limit to maxImages if more were selected
    const assets = result.assets || [];
    const limitedAssets = assets.slice(0, maxImages);

    if (assets.length > maxImages) {
      Alert.alert('Selection Limit', `Only the first ${maxImages} images will be sent.`);
    }

    return limitedAssets.map(asset => ({
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      fileName: asset.fileName || `image-${Date.now()}.jpg`,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
    }));
  } catch (error) {
    console.error('Error picking multiple images:', error);
    throw error;
  }
};
