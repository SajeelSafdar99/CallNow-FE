"use client"

import { useEffect, useContext } from "react"
import { View, Text, StyleSheet, Image, ActivityIndicator } from "react-native"
import { AuthContext } from "../../context/AuthContext"
import { useNavigation } from "@react-navigation/native"

const SplashScreen = () => {
  const navigation = useNavigation()
  const { state } = useContext(AuthContext)

  useEffect(() => {
    // Add a timeout to ensure the splash screen shows for at least 2 seconds
    const timer = setTimeout(() => {
      // Check if user is authenticated and navigate accordingly
      if (state.isAuthenticated) {
        navigation.navigate("Main")
      } else {
        navigation.navigate("Login")
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [state.isAuthenticated, navigation])

  return (
    <View style={styles.container}>
      <Image source={require("../../assets/images/splash-logo.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>CALLNOW</Text>
      <ActivityIndicator size="large" color="#128C7E" style={styles.loader} />
      <Text style={styles.subtitle}>Connecting...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#128C7E",
    marginBottom: 10,
  },
  loader: {
    marginVertical: 20,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
})

export default SplashScreen
