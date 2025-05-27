package com.callnow;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class SystemSoundModule extends ReactContextBaseJavaModule {
    private MediaPlayer mediaPlayer;
    private Ringtone ringtone;

    public SystemSoundModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "SystemSound";
    }

    @ReactMethod
    public void playDefaultRingtone(Promise promise) {
        try {
            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

            // Stop any existing ringtone
            stopRingtoneInternal();

            // Create and play ringtone
            ringtone = RingtoneManager.getRingtone(getReactApplicationContext(), ringtoneUri);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ringtone.setLooping(true);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AudioAttributes attributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                ringtone.setAudioAttributes(attributes);
            }

            ringtone.play();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to play default ringtone: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopRingtone(Promise promise) {
        try {
            stopRingtoneInternal();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to stop ringtone: " + e.getMessage());
        }
    }

    // Renamed from stopRingtone() to stopRingtoneInternal() to avoid the duplicate method error
    private void stopRingtoneInternal() {
        try {
            if (ringtone != null && ringtone.isPlaying()) {
                ringtone.stop();
                ringtone = null;
            }

            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
                mediaPlayer = null;
            }
        } catch (Exception e) {
            // Silent catch
        }
    }
}
