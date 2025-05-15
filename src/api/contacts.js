import axios from "axios"
import { API_BASE_URL, API_ENDPOINTS } from "../config/api"

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

/**
 * Check if a user exists by phone number
 * @param {string} phoneNumber - Phone number to check
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with user existence data
 */
export const checkUserExists = async (phoneNumber, token) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.CHECK_USER_EXISTS}/${phoneNumber}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error checking if user exists:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to check if user exists"
    }
  }
}

/**
 * Get all contacts for the current user
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with contacts data
 */
export const getContacts = async (token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_CONTACTS, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error getting contacts:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to get contacts"
    }
  }
}

/**
 * Get contact groups for the current user
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with contact groups data
 */
export const getContactGroups = async (token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_CONTACT_GROUPS, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error getting contact groups:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to get contact groups"
    }
  }
}

/**
 * Get a specific contact by ID
 * @param {string} contactId - ID of the contact to retrieve
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with contact data
 */
export const getContactById = async (contactId, token) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.GET_CONTACTS}/${contactId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error getting contact by ID:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to get contact"
    }
  }
}

/**
 * Add a new contact
 * @param {Object} contactData - Contact data to add
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with created contact data
 */
export const addContact = async (contactData, token) => {
  try {
    const response = await api.post(API_ENDPOINTS.ADD_CONTACT, contactData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error adding contact:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to add contact"
    }
  }
}

/**
 * Update an existing contact
 * @param {string} contactId - ID of the contact to update
 * @param {Object} contactData - Updated contact data
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with updated contact data
 */
export const updateContact = async (contactId, contactData, token) => {
  try {
    const response = await api.put(`${API_ENDPOINTS.UPDATE_CONTACT.replace(':contactId', contactId)}`, contactData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error updating contact:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to update contact"
    }
  }
}

/**
 * Delete a contact
 * @param {string} contactId - ID of the contact to delete
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with operation status
 */
export const deleteContact = async (contactId, token) => {
  try {
    const response = await api.delete(`${API_ENDPOINTS.DELETE_CONTACT.replace(':contactId', contactId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error deleting contact:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to delete contact"
    }
  }
}

/**
 * Import multiple contacts at once
 * @param {Array} contacts - Array of contact objects to import
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with imported contacts data
 */
export const importContacts = async (contacts, token) => {
  try {
    const response = await api.post(
      API_ENDPOINTS.IMPORT_CONTACTS,
      { contacts },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return response.data
  } catch (error) {
    console.error("Error importing contacts:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to import contacts"
    }
  }
}
