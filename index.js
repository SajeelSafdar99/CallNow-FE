/**
 * @format
 */

// Import polyfills first - this must be the very first import
import "./polyfills"

// Set up global error handler for uncaught JS errors
const errorHandler = (error, isFatal) => {
  console.log("Global error caught:", error.message)
  console.log("Error stack:", error.stack)

  // You could add more error reporting here
}

// Register the error handler
if (global.ErrorUtils) {
  global.ErrorUtils.setGlobalHandler(errorHandler)
}

// Add a global promise rejection handler
const rejectionTracking = require("promise/setimmediate/rejection-tracking")
rejectionTracking.enable({
  allRejections: true,
  onUnhandled: (id, error) => {
    console.log("Unhandled promise rejection:", error)
  },
  onHandled: () => {},
})

// Import React Native core
import { AppRegistry, LogBox, Text, TextInput, View } from "react-native"

// Ensure text components don't crash on special characters
Text.defaultProps = Text.defaultProps || {}
Text.defaultProps.allowFontScaling = false
TextInput.defaultProps = TextInput.defaultProps || {}
TextInput.defaultProps.allowFontScaling = false

// Ignore specific warnings
LogBox.ignoreLogs([
  "AsyncStorage has been extracted from react-native",
  "Setting a timer for a long period of time",
  "EventEmitter.removeListener",
  "Require cycle:",
  "ViewPropTypes will be removed",
  "ColorPropType will be removed",
  "Failed prop type",
  "Can't perform a React state update on an unmounted component",
])

// Import your app
import App from "./App"
import { name as appName } from "./app.json"

// Wrap the app in an error boundary
const AppWithErrorHandling = () => {
  try {
    return <App />
  } catch (error) {
    console.error("Error rendering App:", error)
    // Return a minimal UI if there's an error
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>Something went wrong</Text>
        <Text>{error.toString()}</Text>
      </View>
    )
  }
}

// Register the app component
AppRegistry.registerComponent(appName, () => AppWithErrorHandling)
