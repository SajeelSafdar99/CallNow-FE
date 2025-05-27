"use client"

import { useState, useEffect, useContext } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native"
import { useNavigation } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as SubscriptionAPI from "../../api/subscription"
import { StripeProvider, CardField, useStripe } from "@stripe/stripe-react-native"
import * as stripe from '@stripe/stripe-react-native';

const SUBSCRIPTION_PRICE = 4.99
const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51N1v9ICmXVqoMpIrAxCprZ01ktSsXZKaSldTOjnyN760s2TjSO44Qaptir6qcSlrjfBRVJqDhDu3WJKLxHOWGw4C00TSdCKqWp" // Replace with your actual Stripe key

const SubscriptionScreen = () => {
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)
  const { createPaymentMethod, confirmPayment } = useStripe()

  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [cardDetails, setCardDetails] = useState(null)
  const [cardError, setCardError] = useState(null)

  // Fetch subscription details
  useEffect(() => {
    fetchSubscriptionDetails()
  }, [])

  const fetchSubscriptionDetails = async () => {
    try {
      setIsLoading(true)
      const response = await SubscriptionAPI.getSubscription(authState.token)

      if (response.success) {
        setHasActiveSubscription(response.hasActiveSubscription)
        setSubscription(response.subscription)
        console.log("Subscription details:", response.subscription)
      } else {
        console.error("Failed to fetch subscription details:", response.message)
      }
    } catch (error) {
      console.error("Error fetching subscription details:", error)
      Alert.alert("Error", "Failed to load subscription details. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle subscription purchase
  const handleSubscribe = async () => {
    if (!cardDetails?.complete) {
      setCardError("Please enter valid card details")
      return
    }

    try {
      setIsProcessing(true)
      setCardError(null)

      // 1. Create payment method with Stripe
      const { paymentMethod, error: paymentMethodError } = await stripe.createPaymentMethod({
        paymentMethodType: "Card",
        billingDetails: {
          email: authState.user?.email || authState.user?.phoneNumber || "",
        },
      })

      if (paymentMethodError) {
        setCardError(paymentMethodError.message)
        console.error("Payment method error:", paymentMethodError)
        return
      }

      // 2. Create payment intent on the server
      const paymentIntentResponse = await SubscriptionAPI.createPaymentIntent(authState.token, SUBSCRIPTION_PRICE)

      if (!paymentIntentResponse.success) {
        Alert.alert("Error", paymentIntentResponse.message || "Failed to create payment")
        return
      }

      // 3. Confirm payment with Stripe - pass the payment method ID
      const { error: confirmError } = await confirmPayment(
        paymentIntentResponse.clientSecret,
        { paymentMethodType: 'Card', paymentMethodId: paymentMethod.id }
      )

      if (confirmError) {
        setCardError(confirmError.message)
        return
      }

      // 4. Create subscription on the server
      const subscribeResponse = await SubscriptionAPI.subscribe(
        authState.token,
        // paymentIntentResponse.paymentIntentId,
        "stripe",
        paymentMethod.id,
        SUBSCRIPTION_PRICE,
      )

      if (subscribeResponse.success) {
        setHasActiveSubscription(true)
        setSubscription(subscribeResponse.subscription)
        Alert.alert("Subscription Successful", "Thank you for subscribing to CallNow Premium!")
      } else {
        Alert.alert("Error", subscribeResponse.message || "Failed to complete subscription")
      }
    } catch (error) {
      console.error("Subscription error:", error)
      Alert.alert("Error", "An unexpected error occurred. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle free trial
  const handleStartFreeTrial = async () => {
    try {
      setIsProcessing(true)
      const response = await SubscriptionAPI.startFreeTrial(authState.token)

      if (response.success) {
        setHasActiveSubscription(true)
        setSubscription(response.subscription)
        Alert.alert("Free Trial Started", "Your 7-day free trial has started. Enjoy CallNow Premium!")
      } else {
        Alert.alert("Error", response.message || "Failed to start free trial")
      }
    } catch (error) {
      console.error("Free trial error:", error)
      Alert.alert("Error", "Failed to start free trial. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle subscription cancellation
  const handleCancelSubscription = async () => {
    Alert.alert(
      "Cancel Subscription",
      "Are you sure you want to cancel your subscription? You'll still have access until the end of your current billing period.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setIsProcessing(true)
              const response = await SubscriptionAPI.cancelSubscription(authState.token)

              if (response.success) {
                // Update subscription but keep hasActiveSubscription true until end date
                const updatedSubscription = { ...subscription, status: "canceled", autoRenew: false }
                setSubscription(updatedSubscription)
                Alert.alert(
                  "Subscription Canceled",
                  "Your subscription has been canceled. You'll have access until the end of your current billing period.",
                )
              } else {
                Alert.alert("Error", response.message || "Failed to cancel subscription")
              }
            } catch (error) {
              console.error("Cancellation error:", error)
              Alert.alert("Error", "Failed to cancel subscription. Please try again.")
            } finally {
              setIsProcessing(false)
            }
          },
        },
      ],
    )
  }

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  // Render loading state
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
        <Text style={[styles.loadingText, { color: currentTheme.placeholder }]}>Loading subscription details...</Text>
      </View>
    )
  }

  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <ScrollView style={[styles.container, { backgroundColor: currentTheme.background }]}>
        {/* Subscription Header */}
        <View style={[styles.header, { backgroundColor: currentTheme.card }]}>
          <View style={styles.headerContent}>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{hasActiveSubscription ? "Premium" : "Free Plan"}</Text>
            </View>
            <Text style={[styles.headerTitle, { color: currentTheme.text }]}>
              CallNow {hasActiveSubscription ? "Premium" : "Free"}
            </Text>
            {hasActiveSubscription && subscription?.status === "trial" ? (
              <Text style={[styles.headerSubtitle, { color: currentTheme.placeholder }]}>
                Trial ends on {formatDate(subscription?.trialEndsAt)}
              </Text>
            ) : hasActiveSubscription ? (
              <Text style={[styles.headerSubtitle, { color: currentTheme.placeholder }]}>
                {subscription?.status === "canceled"
                  ? `Access until ${formatDate(subscription?.endDate)}`
                  : `Renews on ${formatDate(subscription?.endDate)}`}
              </Text>
            ) : (
              <Text style={[styles.headerSubtitle, { color: currentTheme.placeholder }]}>
                Upgrade to Premium for more features
              </Text>
            )}
          </View>
        </View>

        {/* Plan Comparison */}
        <View style={[styles.section, { backgroundColor: currentTheme.card }]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Plan Comparison</Text>

          <View style={styles.comparisonTable}>
            <View style={styles.comparisonRow}>
              <Text style={[styles.featureLabel, { color: currentTheme.text }]}>Feature</Text>
              <Text style={[styles.planLabel, { color: currentTheme.placeholder }]}>Free</Text>
              <Text style={[styles.planLabel, { color: currentTheme.primary }]}>Premium</Text>
            </View>

            <View style={[styles.comparisonRow, { borderTopColor: currentTheme.border }]}>
              <Text style={[styles.featureLabel, { color: currentTheme.text }]}>Active Devices</Text>
              <Text style={[styles.planValue, { color: currentTheme.placeholder }]}>1</Text>
              <Text style={[styles.planValue, { color: currentTheme.primary }]}>Unlimited</Text>
            </View>

            <View style={[styles.comparisonRow, { borderTopColor: currentTheme.border }]}>
              <Text style={[styles.featureLabel, { color: currentTheme.text }]}>Call Quality</Text>
              <Text style={[styles.planValue, { color: currentTheme.placeholder }]}>Standard</Text>
              <Text style={[styles.planValue, { color: currentTheme.primary }]}>HD</Text>
            </View>

            <View style={[styles.comparisonRow, { borderTopColor: currentTheme.border }]}>
              <Text style={[styles.featureLabel, { color: currentTheme.text }]}>Group Calls</Text>
              <Text style={[styles.planValue, { color: currentTheme.placeholder }]}>Up to 4</Text>
              <Text style={[styles.planValue, { color: currentTheme.primary }]}>Up to 8</Text>
            </View>

            <View style={[styles.comparisonRow, { borderTopColor: currentTheme.border }]}>
              <Text style={[styles.featureLabel, { color: currentTheme.text }]}>Cloud Storage</Text>
              <Text style={[styles.planValue, { color: currentTheme.placeholder }]}>1 GB</Text>
              <Text style={[styles.planValue, { color: currentTheme.primary }]}>5 GB</Text>
            </View>
          </View>
        </View>

        {/* Subscription Actions */}
        {!hasActiveSubscription ? (
          <View style={[styles.section, { backgroundColor: currentTheme.card }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Subscribe to Premium</Text>

            <View style={styles.pricingContainer}>
              <Text style={[styles.price, { color: currentTheme.text }]}>${SUBSCRIPTION_PRICE}</Text>
              <Text style={[styles.pricePeriod, { color: currentTheme.placeholder }]}>/month</Text>
            </View>

            <Text style={[styles.pricingDescription, { color: currentTheme.placeholder }]}>
              Unlock all premium features with a monthly subscription. Cancel anytime.
            </Text>

            <View style={styles.paymentSection}>
              <Text style={[styles.paymentLabel, { color: currentTheme.text }]}>Payment Method</Text>

              <CardField
                postalCodeEnabled={false}
                placeholder={{
                  number: "4242 4242 4242 4242",
                }}
                cardStyle={{
                  backgroundColor: theme === "dark" ? "#333333" : currentTheme.input,
                  textColor: currentTheme.text,
                  placeholderColor: theme === "dark" ? "#999999" : currentTheme.placeholder,
                  borderColor: currentTheme.border,
                  borderWidth: 1,
                  borderRadius: 8,
                }}
                style={styles.cardField}
                onCardChange={(cardDetails) => {
                  setCardDetails(cardDetails)
                  if (cardDetails.complete) {
                    setCardError(null)
                  }
                }}
              />

              {cardError && <Text style={styles.errorText}>{cardError}</Text>}

              <TouchableOpacity
                style={[styles.subscribeButton, { backgroundColor: currentTheme.primary }]}
                onPress={handleSubscribe}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.trialButton, { backgroundColor: "#FF9500" }]}
                onPress={handleStartFreeTrial}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.trialButtonText}>Start 7-Day Free Trial</Text>
                )}
              </TouchableOpacity>

              <Text style={[styles.termsText, { color: currentTheme.placeholder }]}>
                By subscribing, you agree to our Terms of Service and Privacy Policy. Your subscription will
                automatically renew each month until canceled.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.section, { backgroundColor: currentTheme.card }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Subscription Details</Text>

            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: currentTheme.placeholder }]}>Plan</Text>
              <Text style={[styles.detailValue, { color: currentTheme.text }]}>Premium</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: currentTheme.placeholder }]}>Status</Text>
              <View
                style={[styles.statusBadge, { backgroundColor: getStatusColor(subscription?.status, currentTheme) }]}
              >
                <Text style={styles.statusBadgeText}>{formatStatus(subscription?.status)}</Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: currentTheme.placeholder }]}>Start Date</Text>
              <Text style={[styles.detailValue, { color: currentTheme.text }]}>
                {formatDate(subscription?.startDate)}
              </Text>
            </View>

            {subscription?.status === "trial" ? (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: currentTheme.placeholder }]}>Trial Ends</Text>
                <Text style={[styles.detailValue, { color: currentTheme.text }]}>
                  {formatDate(subscription?.trialEndsAt)}
                </Text>
              </View>
            ) : (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: currentTheme.placeholder }]}>
                  {subscription?.status === "canceled" ? "Access Until" : "Next Billing Date"}
                </Text>
                <Text style={[styles.detailValue, { color: currentTheme.text }]}>
                  {formatDate(subscription?.endDate)}
                </Text>
              </View>
            )}

            {subscription?.amount && (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: currentTheme.placeholder }]}>Price</Text>
                <Text style={[styles.detailValue, { color: currentTheme.text }]}>
                  ${subscription.amount}/{subscription?.currency?.toLowerCase() || "usd"}
                </Text>
              </View>
            )}

            {subscription?.status !== "canceled" && (
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: currentTheme.border }]}
                onPress={handleCancelSubscription}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FF3B30" />
                ) : (
                  <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Payment Methods Section */}
        <View style={styles.paymentMethodsContainer}>
          <Text style={[styles.paymentMethodsTitle, { color: currentTheme.placeholder }]}>
            Secure Payment Powered By
          </Text>
          <View style={styles.paymentMethodsLogos}>
            <Ionicons name="card-outline" size={24} color={currentTheme.placeholder} />
            <Text style={[styles.stripeLogo, { color: currentTheme.text }]}>stripe</Text>
          </View>
        </View>
      </ScrollView>
    </StripeProvider>
  )
}

// Helper functions
const getStatusColor = (status, theme) => {
  switch (status) {
    case "active":
      return theme.primary
    case "trial":
      return "#FF9500"
    case "canceled":
      return "#FF3B30"
    case "expired":
      return "#8E8E93"
    default:
      return theme.placeholder
  }
}

const formatStatus = (status) => {
  switch (status) {
    case "active":
      return "Active"
    case "trial":
      return "Trial"
    case "canceled":
      return "Canceled"
    case "expired":
      return "Expired"
    default:
      return "Unknown"
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    padding: 20,
    alignItems: "center",
    marginBottom: 15,
    marginHorizontal: 15,
    borderRadius: 10,
  },
  headerContent: {
    alignItems: "center",
  },
  planBadge: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  planBadgeText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  section: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  comparisonTable: {
    width: "100%",
  },
  comparisonRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  featureLabel: {
    flex: 2,
    fontSize: 16,
  },
  planLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  planValue: {
    flex: 1,
    fontSize: 14,
    textAlign: "center",
  },
  pricingContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: 10,
  },
  price: {
    fontSize: 36,
    fontWeight: "bold",
  },
  pricePeriod: {
    fontSize: 16,
    marginLeft: 4,
  },
  pricingDescription: {
    textAlign: "center",
    marginBottom: 20,
    fontSize: 14,
  },
  paymentSection: {
    marginTop: 10,
  },
  paymentLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 10,
  },
  cardField: {
    width: "100%",
    height: 50,
    marginBottom: 15,
  },
  errorText: {
    color: "#FF3B30",
    marginBottom: 15,
    fontSize: 14,
  },
  subscribeButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  subscribeButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  trialButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 15,
  },
  trialButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  termsText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  detailLabel: {
    fontSize: 16,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
  },
  cancelButton: {
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    color: "#FF3B30",
    fontWeight: "bold",
    fontSize: 16,
  },
  paymentMethodsContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  paymentMethodsTitle: {
    fontSize: 14,
    marginBottom: 10,
  },
  paymentMethodsLogos: {
    flexDirection: "row",
    alignItems: "center",
  },
  stripeLogo: {
    fontSize: 24,
    fontWeight: "bold",
    marginLeft: 8,
  },
})

export default SubscriptionScreen
