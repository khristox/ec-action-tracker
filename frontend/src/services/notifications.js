// src/services/notifications.js
import axios from 'axios';

// Get base URL and sanitize it by removing trailing slashes or duplicate /api/v1
const rawBaseUrl = import.meta.env.VITE_API_URL || '';
const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '');

const NOTIFICATIONS_ENDPOINT = `${cleanBaseUrl}/api/v1/action-tracker/notifications`;

export const sendNotifications = async (payload, authToken) => {
  try {
    console.log('📧 Sending notification request:', payload);

    const headers = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await axios.post(
      `${NOTIFICATIONS_ENDPOINT}/send-meeting-notification`,
      payload,
      { headers, timeout: 30000 }
    );

    console.log('✅ Notification response:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ Failed to send notifications:', error.message);
    
    return {
      success: false,
      message: error.response?.data?.detail || error.message || 'Failed to send notifications',
    };
  }
};

export const getNotifications = async (filters, authToken) => {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const url = `${NOTIFICATIONS_ENDPOINT}/me?${params.toString()}`;
    const response = await axios.get(url, { headers });

    return response.data;

  } catch (error) {
    console.error('❌ Failed to fetch notifications:', error);
    throw error;
  }
};

export default {
  sendNotifications,
  getNotifications,
};