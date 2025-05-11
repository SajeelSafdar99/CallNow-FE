import './polyfills';
import App from "./App"
import { name as appName } from "./app.json"
import {AppRegistry} from 'react-native';

const AppWithErrorHandling = () => {
  try {
    return <App />
  } catch (error) {
    console.error("Error rendering App:", error)
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
