import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { requestOTP, verifyOTP } from '../services/api';

export default function LoginScreen({ onLogin }) {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState('phone'); // 'phone' or 'otp'
    const [loading, setLoading] = useState(false);

    const handleRequestOTP = async () => {
        if (phoneNumber.length < 10) {
            Alert.alert('Error', 'Please enter a valid phone number');
            return;
        }

        setLoading(true);
        try {
            const response = await requestOTP(phoneNumber);
            Alert.alert('Success', 'OTP sent to your phone');
            setStep('otp');

            // Show dev OTP in development
            if (response.dev_otp) {
                Alert.alert('Dev OTP', `Your OTP is: ${response.dev_otp}`);
            }
        } catch (error) {
            Alert.alert('Error', error.response?.data?.detail || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (otp.length !== 6) {
            Alert.alert('Error', 'Please enter the 6-digit OTP');
            return;
        }

        setLoading(true);
        try {
            const response = await verifyOTP(phoneNumber, otp);
            onLogin(response.access_token, response.user);
        } catch (error) {
            Alert.alert('Error', error.response?.data?.detail || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <Text style={styles.title}>🏛️ Kyamatu Ward</Text>
                <Text style={styles.subtitle}>Citizen Services</Text>

                {step === 'phone' ? (
                    <>
                        <TextInput
                            style={styles.input}
                            placeholder="Phone Number (0712345678)"
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            keyboardType="phone-pad"
                            maxLength={10}
                        />
                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleRequestOTP}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Send OTP</Text>
                            )}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter 6-digit OTP"
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="number-pad"
                            maxLength={6}
                        />
                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleVerifyOTP}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Verify & Login</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => setStep('phone')}
                        >
                            <Text style={styles.secondaryButtonText}>Back</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#7c3aed',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        color: '#fff',
        textAlign: 'center',
        marginBottom: 40,
        opacity: 0.9,
    },
    input: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        marginBottom: 16,
    },
    button: {
        backgroundColor: '#ec4899',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    secondaryButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#fff',
        fontSize: 16,
    },
});
