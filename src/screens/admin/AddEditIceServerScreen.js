"use client"

import { useState, useEffect, useContext } from "react"
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useNavigation, useRoute } from "@react-navigation/native"
import * as IceServerAPI from "../../api/ice-server"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
// Consider using a DateTimePicker for expiresAt
// import DateTimePicker from '@react-native-community/datetimepicker';

const AddEditIceServerScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const serverToEdit = route.params?.server
  const isEditing = !!serverToEdit

  const [urls, setUrls] = useState(isEditing ? serverToEdit.urls.join(", ") : "")
  const [username, setUsername] = useState(isEditing ? serverToEdit.username || "" : "")
  const [credential, setCredential] = useState(isEditing ? serverToEdit.credential || "" : "")
  const [priority, setPriority] = useState(isEditing ? serverToEdit.priority?.toString() : "0")
  const [serverType, setServerType] = useState(isEditing ? serverToEdit.serverType : "stun") // Default to stun
  const [region, setRegion] = useState(isEditing ? serverToEdit.region || "global" : "global")
  const [provider, setProvider] = useState(isEditing ? serverToEdit.provider || "custom" : "custom")
  const [isActive, setIsActive] = useState(isEditing ? serverToEdit.isActive : true)
  const [expiresAt, setExpiresAt] = useState(
    isEditing && serverToEdit.expiresAt ? new Date(serverToEdit.expiresAt).toISOString().split("T")[0] : "",
  ) // YYYY-MM-DD

  const [loading, setLoading] = useState(false)
  // const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Edit ICE Server" : "Add ICE Server",
      headerRight: () => (
        <TouchableOpacity onPress={handleSave} style={{ marginRight: 15 }} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={currentTheme.headerTint} />
          ) : (
            <Ionicons name="save-outline" size={24} color={currentTheme.headerTint} />
          )}
        </TouchableOpacity>
      ),
    })
  }, [
    navigation,
    isEditing,
    loading,
    urls,
    username,
    credential,
    priority,
    serverType,
    region,
    provider,
    isActive,
    expiresAt,
    currentTheme,
  ])

  const handleSave = async () => {
    if (!urls.trim() || !serverType.trim()) {
      Alert.alert("Validation Error", "URLs and Server Type are required.")
      return
    }

    const urlsArray = urls
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url)
    if (urlsArray.length === 0) {
      Alert.alert("Validation Error", "Please provide at least one valid URL.")
      return
    }

    let serverPayload
    if (isEditing) {
      serverPayload = {
        urls: urlsArray,
        username: username.trim() || undefined,
        credential: credential.trim() || undefined,
        priority: Number.parseInt(priority, 10) || 0,
        // serverType: serverType.trim(), // Exclude if backend doesn't update it
        region: region.trim() || "global",
        provider: provider.trim() || "custom",
        isActive,
        expiresAt: expiresAt.trim() ? new Date(expiresAt.trim()).toISOString() : null,
      }
    } else {
      serverPayload = {
        urls: urlsArray,
        username: username.trim() || undefined,
        credential: credential.trim() || undefined,
        priority: Number.parseInt(priority, 10) || 0,
        serverType: serverType.trim(), // Include for add
        region: region.trim() || "global",
        provider: provider.trim() || "custom",
        isActive,
        expiresAt: expiresAt.trim() ? new Date(expiresAt.trim()).toISOString() : null,
      }
    }

    setLoading(true)
    try {
      let response
      if (isEditing) {
        response = await IceServerAPI.updateIceServer(serverToEdit._id, serverPayload)
      } else {
        response = await IceServerAPI.addIceServer(serverPayload)
      }

      if (response.success) {
        Alert.alert("Success", `ICE server ${isEditing ? "updated" : "added"} successfully.`)
        navigation.goBack()
      } else {
        Alert.alert("Error", response.message || `Failed to ${isEditing ? "update" : "add"} ICE server.`)
      }
    } catch (error) {
      console.error("Save ICE server error:", error)
      Alert.alert("Error", "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  // const onDateChange = (event, selectedDate) => {
  //   setShowDatePicker(Platform.OS === 'ios');
  //   if (selectedDate) {
  //     setExpiresAt(selectedDate.toISOString().split('T')[0]);
  //   }
  // };

  const inputStyle = [
    styles.input,
    { backgroundColor: currentTheme.inputBackground, color: currentTheme.text, borderColor: currentTheme.border },
  ]
  const labelStyle = [styles.label, { color: currentTheme.text }]

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={labelStyle}>URLs (comma-separated)*</Text>
        <TextInput
          style={inputStyle}
          value={urls}
          onChangeText={setUrls}
          placeholder="e.g., stun:stun.example.com, turn:turn.example.com"
          placeholderTextColor={currentTheme.placeholder}
          multiline
        />

        <Text style={labelStyle}>Server Type*</Text>
        <TextInput
          style={inputStyle}
          value={serverType}
          onChangeText={setServerType}
          placeholder="e.g., stun, turn"
          placeholderTextColor={currentTheme.placeholder}
          editable={!isEditing} // Make non-editable in edit mode
        />
        {/* Consider Picker for serverType: ['stun', 'turn', 'stuns', 'turns'] */}

        <Text style={labelStyle}>Username</Text>
        <TextInput
          style={inputStyle}
          value={username}
          onChangeText={setUsername}
          placeholder="Optional"
          placeholderTextColor={currentTheme.placeholder}
        />

        <Text style={labelStyle}>Credential</Text>
        <TextInput
          style={inputStyle}
          value={credential}
          onChangeText={setCredential}
          placeholder="Optional"
          placeholderTextColor={currentTheme.placeholder}
          secureTextEntry
        />

        <Text style={labelStyle}>Priority</Text>
        <TextInput
          style={inputStyle}
          value={priority}
          onChangeText={setPriority}
          placeholder="e.g., 0, 10"
          placeholderTextColor={currentTheme.placeholder}
          keyboardType="numeric"
        />

        <Text style={labelStyle}>Region</Text>
        <TextInput
          style={inputStyle}
          value={region}
          onChangeText={setRegion}
          placeholder="e.g., global, us-east, eu-west"
          placeholderTextColor={currentTheme.placeholder}
        />
        {/* Consider Picker for region */}

        <Text style={labelStyle}>Provider</Text>
        <TextInput
          style={inputStyle}
          value={provider}
          onChangeText={setProvider}
          placeholder="e.g., custom, twilio, xirsys"
          placeholderTextColor={currentTheme.placeholder}
        />
        {/* Consider Picker for provider */}

        <View style={styles.switchContainer}>
          <Text style={labelStyle}>Active</Text>
          <Switch
            trackColor={{ false: currentTheme.disabled, true: currentTheme.primary }}
            thumbColor={isActive ? currentTheme.card : currentTheme.card}
            ios_backgroundColor={currentTheme.disabled}
            onValueChange={setIsActive}
            value={isActive}
          />
        </View>

        <Text style={labelStyle}>Expires At (YYYY-MM-DD)</Text>
        <TextInput
          style={inputStyle}
          value={expiresAt}
          onChangeText={setExpiresAt}
          placeholder="Optional, e.g., 2025-12-31"
          placeholderTextColor={currentTheme.placeholder}
        />
        {/*
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={inputStyle}>
            <Text style={{color: expiresAt ? currentTheme.text : currentTheme.placeholder}}>
                {expiresAt || "Optional, e.g., 2025-12-31"}
            </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={expiresAt ? new Date(expiresAt) : new Date()}
            mode="date"
            display="default"
            onChange={onDateChange}
            textColor={currentTheme.text} // Note: textColor might not work on all platforms/modes
          />
        )}
        */}

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: currentTheme.primary }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{isEditing ? "Update Server" : "Add Server"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 16,
    marginBottom: 15,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  saveButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
})

export default AddEditIceServerScreen
