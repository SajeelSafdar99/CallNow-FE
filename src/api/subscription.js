import axios from "axios"
import { API_BASE_URL } from "../config/api"

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

/**
 * Get subscription details for the current user
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with subscription data
 */
export const getSubscription = async (token) => {
  try {
    const response = await api.get("/subscriptions", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error getting subscription:", error)
    return {
      success: false,
      message: error.response?.data?.message || "Failed to get subscription details",
    }
  }
}

/**
 * Create a payment intent for subscription
 * @param {string} token - Authentication token
 * @param {number} amount - Payment amount
 * @returns {Promise} - Response with client secret
 */
export const createPaymentIntent = async (token, amount) => {
  try {
    const response = await api.post(
      "/subscriptions/payment-intent",
      { amount },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    return response.data
  } catch (error) {
    console.error("Error creating payment intent:", error)
    return {
      success: false,
      message: error.response?.data?.message || "Failed to create payment intent",
    }
  }
}

/**
 * Subscribe to premium plan
 * @param {string} token - Authentication token
 * @param {string} paymentMethod - Payment method ID
 * @param {string} paymentId - Payment intent ID
 * @param {number} amount - Payment amount
 * @returns {Promise} - Response with subscription data
 */
export const subscribe = async (token, paymentMethod , paymentId, amount) => {
  try {
    const response = await api.post(
      "/subscriptions/subscribe",
      { paymentMethod, paymentId, amount },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return response.data
  } catch (error) {
    console.error("Error subscribing:", error)
    return {
      success: false,
      message: error.response?.data?.message || "Failed to subscribe",
    }
  }
}


/**
 * Cancel subscription
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with operation status
 */
export const cancelSubscription = async (token) => {
  try {
    const response = await api.post(
      "/subscriptions/cancel",
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    return response.data
  } catch (error) {
    console.error("Error canceling subscription:", error)
    return {
      success: false,
      message: error.response?.data?.message || "Failed to cancel subscription",
    }
  }
}

/**
 * Renew subscription
 * @param {string} token - Authentication token
 * @param {string} paymentId - Payment intent ID
 * @returns {Promise} - Response with subscription data
 */
export const renewSubscription = async (token, paymentId) => {
  try {
    const response = await api.post(
      "/subscriptions/renew",
      { paymentId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    return response.data
  } catch (error) {
    console.error("Error renewing subscription:", error)
    return {
      success: false,
      message: error.response?.data?.message || "Failed to renew subscription",
    }
  }
}

/**
 * Start free trial
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with trial data
 */
export const startFreeTrial = async (token) => {
  try {
    const response = await api.post(
      "/subscriptions/trial",
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    return response.data
  } catch (error) {
    console.error("Error starting free trial:", error)
    return {
      success: false,
      message: error.response?.data?.message || "Failed to start free trial",
    }
  }
}




//
//
//
// import axios from "axios"
// import { API_BASE_URL } from "../config/api"
//
// // Create axios instance
// const api = axios.create({
//   baseURL: API_BASE_URL,
//   headers: {
//     "Content-Type": "application/json",
//   },
// })
//
// /**
//  * Get subscription details for the current user
//  * @param {string} token - Authentication token
//  * @returns {Promise} - Response with subscription data
//  */
// export const getSubscription = async (token) => {
//   try {
//     const response = await api.get(API_BASE_URL.GET_SUBSCRIPTION, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     })
//     return response.data
//   } catch (error) {
//     console.error("Error getting subscription:", error)
//     return {
//       success: false,
//       message: error.response?.data?.message || "Failed to get subscription details",
//     }
//   }
// }
//
// /**
//  * Create a payment intent for subscription
//  * @param {string} token - Authentication token
//  * @param {number} amount - Payment amount
//  * @returns {Promise} - Response with client secret
//  */
// export const createPaymentIntent = async (token, amount) => {
//   try {
//     const response = await api.post(
//       API_BASE_URL.CREATE_PAYMENT_INTENT,
//       { amount },
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     )
//     return response.data
//   } catch (error) {
//     console.error("Error creating payment intent:", error)
//     return {
//       success: false,
//       message: error.response?.data?.message || "Failed to create payment intent",
//     }
//   }
// }
//
// /**
//  * Subscribe to premium plan
//  * @param {string} token - Authentication token
//  * @param {string} paymentMethod - Payment method ID
//  * @param {string} paymentId - Payment intent ID
//  * @param {number} amount - Payment amount
//  * @returns {Promise} - Response with subscription data
//  */
// export const subscribe = async (token, paymentMethod, paymentId, amount, paymentMethodType = "card") => {
//   try {
//     const response = await api.post(
//       API_BASE_URL.SUBSCRIBE,
//       { paymentMethod, paymentId, amount, paymentMethodType },
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       },
//     )
//     return response.data
//   } catch (error) {
//     console.error("Error subscribing:", error)
//     return {
//       success: false,
//       message: error.response?.data?.message || "Failed to subscribe",
//     }
//   }
// }
//
//
// /**
//  * Cancel subscription
//  * @param {string} token - Authentication token
//  * @returns {Promise} - Response with operation status
//  */
// export const cancelSubscription = async (token) => {
//   try {
//     const response = await api.post(
//       API_BASE_URL.CANCEL_SUBSCRIPTION,
//       {},
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     )
//     return response.data
//   } catch (error) {
//     console.error("Error canceling subscription:", error)
//     return {
//       success: false,
//       message: error.response?.data?.message || "Failed to cancel subscription",
//     }
//   }
// }
//
// /**
//  * Renew subscription
//  * @param {string} token - Authentication token
//  * @param {string} paymentId - Payment intent ID
//  * @returns {Promise} - Response with subscription data
//  */
// export const renewSubscription = async (token, paymentId) => {
//   try {
//     const response = await api.post(
//       API_BASE_URL.RENEW_SUBSCRIPTION,
//       { paymentId },
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     )
//     return response.data
//   } catch (error) {
//     console.error("Error renewing subscription:", error)
//     return {
//       success: false,
//       message: error.response?.data?.message || "Failed to renew subscription",
//     }
//   }
// }
//
// /**
//  * Start free trial
//  * @param {string} token - Authentication token
//  * @returns {Promise} - Response with trial data
//  */
// export const startFreeTrial = async (token) => {
//   try {
//     const response = await api.post(
//       API_BASE_URL.START_FREE_TRIAL,
//       {},
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     )
//     return response.data
//   } catch (error) {
//     console.error("Error starting free trial:", error)
//     return {
//       success: false,
//       message: error.response?.data?.message || "Failed to start free trial",
//     }
//   }
// }
