import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8000';

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
    const response = await api.post('/api/v1/auth/request-otp', {
        phone_number: phoneNumber,
    });
    return response.data;
};

export const verifyOTP = async (phoneNumber, otpCode) => {
    const response = await api.post('/api/v1/auth/verify-otp', {
        phone_number: phoneNumber,
        otp_code: otpCode,
    });
    return response.data;
};

// Issues APIs
export const getIssues = async (phoneNumber) => {
    const response = await api.get(`/api/v1/issues?phone_number=${phoneNumber}`);
    return response.data;
};

export const createIssue = async (issueData, phoneNumber) => {
    const response = await api.post(`/api/v1/issues?phone_number=${phoneNumber}`, issueData);
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

    const response = await api.post('/api/v1/upload/photo', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

// Bursaries API
export const getBursaries = async (phoneNumber) => {
    const response = await api.get(`/api/v1/bursaries?phone_number=${phoneNumber}`);
    return response.data;
};

export default api;
