// Add this file to your project root

// Polyfill for EventEmitter
global.EventEmitter = require("events")

// Other potential polyfills
global.process = global.process || {}
global.process.env = global.process.env || {}

// Ensure Buffer is available
global.Buffer = global.Buffer || require("buffer").Buffer

// Fix for Expo Vector Icons - create mock implementation
if (!global.Expo) {
  global.Expo = {}
}

// Create a mock Ionicons implementation to prevent crashes
const createMockIconComponent = () => {
  const MockIonicons = (props) => null
  MockIonicons.font = {}
  MockIonicons.loadFont = () => Promise.resolve()
  return MockIonicons
}

// Add this to the global scope to be used as a fallback
global.MockIonicons = createMockIconComponent()

// Patch require to handle @expo/vector-icons safely
const originalRequire = global.require
global.require = (moduleName) => {
  try {
    if (
      moduleName === "@expo/vector-icons" ||
      moduleName === "@expo/vector-icons/Ionicons" ||
      moduleName.includes("vector-icons")
    ) {
      // Return a safe version that won't crash
      const original = originalRequire(moduleName)
      // If Ionicons is undefined, use our mock
      if (!original.Ionicons) {
        original.Ionicons = global.MockIonicons
      }
      return original
    }
    return originalRequire(moduleName)
  } catch (error) {
    console.warn(`Error requiring module: ${moduleName}`, error)
    // Return empty object for modules that fail to load
    return {}
  }
}
