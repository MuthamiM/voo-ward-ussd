import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Use 10.0.2.2 for Android Emulator, localhost for iOS/Web
const DEV_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
const API_URL = Constants.expoConfig?.extra?.apiUrl || DEV_API_URL;

const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Auth APIs
export const requestOTP = async (phoneNumber) => {
    // Backend expects { phoneNumber }
    const response = await api.post('/api/citizen/request-otp', {
        phoneNumber: phoneNumber,
    });
    return response.data;
};

export const verifyOTP = async (phoneNumber, otpCode) => {
    // Backend expects { phoneNumber, otp }
    const response = await api.post('/api/citizen/verify-otp', {
        phoneNumber: phoneNumber,
        otp: otpCode,
    });
    return response.data;
};

// Issues APIs
export const getIssues = async () => {
    const response = await api.get('/api/citizen/issues');
    return response.data;
};

export const createIssue = async (issueData) => {
    // issueData should contain { category, description, location, title }
    const response = await api.post('/api/citizen/issues', issueData);
    return response.data;
};

// Upload API
export const uploadPhoto = async (uri) => {
    const formData = new FormData();
    formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
    });

    // Note: You might need to implement this endpoint in citizenPortal.js or use existing upload route
    const response = await api.post('/api/citizen/upload/photo', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

// Bursaries API
export const getBursaries = async () => {
    const response = await api.get('/api/citizen/bursaries');
    return response.data;
};

// Announcements API
export const getAnnouncements = async () => {
    const response = await api.get('/api/citizen/announcements');
    return response.data;
};

export default api;
