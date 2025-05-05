import axios from "axios"
import { API_BASE_URL, API_ENDPOINTS } from "../config/api"

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Check if a user exists by phone number
export const checkUserExists = async (phoneNumber, token) => {
  try {
    const response = await api.get(API_ENDPOINTS.CHECK_USER_EXISTS.replace(":phoneNumber", phoneNumber), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Add a contact
export const addContact = async (userId, contactData, token) => {
  try {
    const response = await api.post(
      API_ENDPOINTS.ADD_CONTACT,
      {
        userId,
        ...contactData,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return response.data
  } catch (error) {
    throw error
  }
}

// Get all contacts
export const getContacts = async (params, token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_CONTACTS, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Get contact by ID
export const getContactById = async (contactId, token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_CONTACT_BY_ID.replace(":contactId", contactId), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Update contact
export const updateContact = async (contactId, updates, token) => {
  try {
    const response = await api.put(API_ENDPOINTS.UPDATE_CONTACT.replace(":contactId", contactId), updates, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Delete contact
export const deleteContact = async (contactId, token) => {
  try {
    const response = await api.delete(API_ENDPOINTS.DELETE_CONTACT.replace(":contactId", contactId), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Get contact groups
export const getContactGroups = async (token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_CONTACT_GROUPS, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Import contacts (bulk add)
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
    throw error
  }
}
