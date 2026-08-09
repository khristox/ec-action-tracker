// src/services/notifications.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.REACT_APP_API_URL || 'http://localhost:8001';
const NOTIFICATIONS_ENDPOINT = `${API_BASE_URL}/api/v1/notifications`;

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
