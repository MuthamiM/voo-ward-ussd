import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Animated,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestOTP, verifyOTP } from '../services/api';

export default function LoginScreen({ onLogin }) {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState('phone'); // 'phone' or 'otp'
    const [loading, setLoading] = useState(false);
    const [fadeAnim] = useState(new Animated.Value(0));
    const [slideAnim] = useState(new Animated.Value(50));

    React.useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleSendOTP = async () => {
        if (!phoneNumber) {
            alert('Please enter your phone number');
            return;
        }

        setLoading(true);
        try {
            await requestOTP(phoneNumber);
            setStep('otp');
            // Reset animations for OTP screen
            fadeAnim.setValue(0);
            slideAnim.setValue(50);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ]).start();
        } catch (error) {
            alert('Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp) {
            alert('Please enter the OTP code');
            return;
        }

        setLoading(true);
        try {
            const response = await verifyOTP(phoneNumber, otp);
            await AsyncStorage.setItem('token', response.access_token);
            await AsyncStorage.setItem('user', JSON.stringify(response.user));
            onLogin();
        } catch (error) {
            alert('Invalid OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar barStyle="light-content" />

            {/* Animated Background Gradient */}
            <View style={styles.gradientBackground}>
                <View style={styles.circle1} />
                <View style={styles.circle2} />
                <View style={styles.circle3} />
            </View>

            <Animated.View
                style={[
                    styles.content,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                {/* Logo/Icon */}
                <View style={styles.logoContainer}>
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoIcon}>🏛️</Text>
                    </View>
                    <Text style={styles.appName}>Kyamatu Ward</Text>
                    <Text style={styles.tagline}>Citizen Services Platform</Text>
                </View>

                {/* Glass Card */}
                <View style={styles.glassCard}>
                    {step === 'phone' ? (
                        <>
                            <Text style={styles.title}>Welcome Back</Text>
                            <Text style={styles.subtitle}>
                                Enter your phone number to continue
                            </Text>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputIcon}>📱</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0712 345 678"
                                    placeholderTextColor="#9ca3af"
                                    value={phoneNumber}
                                    onChangeText={setPhoneNumber}
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleSendOTP}
                                disabled={loading}
                            >
                                <Text style={styles.buttonText}>
                                    {loading ? 'Sending...' : 'Send OTP'}
                                </Text>
                                <Text style={styles.buttonIcon}>→</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.title}>Verify OTP</Text>
                            <Text style={styles.subtitle}>
                                Enter the 6-digit code sent to{'\n'}
                                <Text style={styles.phoneHighlight}>{phoneNumber}</Text>
                            </Text>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputIcon}>🔐</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="000000"
                                    placeholderTextColor="#9ca3af"
                                    value={otp}
                                    onChangeText={setOtp}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleVerifyOTP}
                                disabled={loading}
                            >
                                <Text style={styles.buttonText}>
                                    {loading ? 'Verifying...' : 'Verify & Login'}
                                </Text>
                                <Text style={styles.buttonIcon}>✓</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => setStep('phone')}
                            >
                                <Text style={styles.backButtonText}>← Change Number</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Footer */}
                <Text style={styles.footer}>
                    Powered by VOO Ward Services
                </Text>
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    gradientBackground: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    circle1: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: '#7c3aed',
        opacity: 0.3,
        top: -100,
        right: -50,
        blur: 60,
    },
    circle2: {
        position: 'absolute',
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: '#ec4899',
        opacity: 0.2,
        bottom: -80,
        left: -60,
        blur: 50,
    },
    circle3: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#06b6d4',
        opacity: 0.25,
        top: '40%',
        left: '50%',
        marginLeft: -100,
        blur: 40,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(124, 58, 237, 0.2)',
        borderWidth: 2,
        borderColor: 'rgba(124, 58, 237, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    logoIcon: {
        fontSize: 40,
    },
    appName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    tagline: {
        fontSize: 14,
        color: '#94a3b8',
        letterSpacing: 1,
    },
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 24,
        padding: 28,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#cbd5e1',
        marginBottom: 28,
        lineHeight: 22,
    },
    phoneHighlight: {
        color: '#7c3aed',
        fontWeight: 'bold',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    inputIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: '#fff',
        fontWeight: '500',
    },
    button: {
        backgroundColor: '#7c3aed',
        borderRadius: 16,
        paddingVertical: 18,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: 'bold',
        marginRight: 8,
    },
    buttonIcon: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    backButton: {
        marginTop: 16,
        alignItems: 'center',
    },
    backButtonText: {
        color: '#94a3b8',
        fontSize: 15,
        fontWeight: '600',
    },
    footer: {
        textAlign: 'center',
        color: '#64748b',
        fontSize: 13,
        marginTop: 32,
        letterSpacing: 0.5,
    },
});
