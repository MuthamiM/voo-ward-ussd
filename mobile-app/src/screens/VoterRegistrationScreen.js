import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function VoterRegistrationScreen({ navigation }) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        nationalId: '',
        fullName: '',
        dateOfBirth: '',
        gender: 'male',
        county: '',
        constituency: '',
        ward: '',
        subLocation: '',
    });

    const counties = ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Machakos'];
    const constituencies = ['Westlands', 'Dagoretti', 'Langata', 'Kasarani'];
    const wards = ['Kileleshwa', 'Lavington', 'Parklands', 'Highridge'];

    const updateField = (field, value) => {
        setFormData({ ...formData, [field]: value });
    };

    const nextStep = () => {
        if (step < 5) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleSubmit = async () => {
        try {
            Alert.alert('Success', 'Voter registration submitted!', [
                { text: 'OK', onPress: () => navigation.navigate('Dashboard') },
            ]);
        } catch (error) {
            Alert.alert('Error', 'Failed to submit registration');
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <View>
                        <Text style={styles.stepTitle}>Personal Information</Text>
                        <Text style={styles.label}>Full Name *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your full name"
                            value={formData.fullName}
                            onChangeText={(text) => updateField('fullName', text)}
                        />

                        <Text style={styles.label}>National ID Number *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter ID number"
                            value={formData.nationalId}
                            onChangeText={(text) => updateField('nationalId', text)}
                            keyboardType="numeric"
                        />

                        <Text style={styles.label}>Date of Birth *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="YYYY-MM-DD"
                            value={formData.dateOfBirth}
                            onChangeText={(text) => updateField('dateOfBirth', text)}
                        />

                        <Text style={styles.label}>Gender *</Text>
                        <Picker
                            selectedValue={formData.gender}
                            style={styles.picker}
                            onValueChange={(value) => updateField('gender', value)}
                        >
                            <Picker.Item label="Male" value="male" />
                            <Picker.Item label="Female" value="female" />
                            <Picker.Item label="Other" value="other" />
                        </Picker>
                    </View>
                );

            case 2:
                return (
                    <View>
                        <Text style={styles.stepTitle}>Location Information</Text>

                        <Text style={styles.label}>County *</Text>
                        <Picker
                            selectedValue={formData.county}
                            style={styles.picker}
                            onValueChange={(value) => updateField('county', value)}
                        >
                            <Picker.Item label="Select County" value="" />
                            {counties.map((county) => (
                                <Picker.Item key={county} label={county} value={county} />
                            ))}
                        </Picker>

                        <Text style={styles.label}>Constituency *</Text>
                        <Picker
                            selectedValue={formData.constituency}
                            style={styles.picker}
                            onValueChange={(value) => updateField('constituency', value)}
                        >
                            <Picker.Item label="Select Constituency" value="" />
                            {constituencies.map((const_) => (
                                <Picker.Item key={const_} label={const_} value={const_} />
                            ))}
                        </Picker>

                        <Text style={styles.label}>Ward *</Text>
                        <Picker
                            selectedValue={formData.ward}
                            style={styles.picker}
                            onValueChange={(value) => updateField('ward', value)}
                        >
                            <Picker.Item label="Select Ward" value="" />
                            {wards.map((ward) => (
                                <Picker.Item key={ward} label={ward} value={ward} />
                            ))}
                        </Picker>

                        <Text style={styles.label}>Sub-Location (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter sub-location"
                            value={formData.subLocation}
                            onChangeText={(text) => updateField('subLocation', text)}
                        />
                    </View>
                );

            case 3:
                return (
                    <View>
                        <Text style={styles.stepTitle}>ID Document Capture</Text>
                        <Text style={styles.instructions}>
                            Take a clear photo of your National ID card. Ensure all corners are visible.
                        </Text>
                        <TouchableOpacity style={styles.cameraButton}>
                            <Text style={styles.cameraButtonText}>📷 Take ID Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cameraButton}>
                            <Text style={styles.cameraButtonText}>🖼️ Choose from Gallery</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 4:
                return (
                    <View>
                        <Text style={styles.stepTitle}>Selfie Verification</Text>
                        <Text style={styles.instructions}>
                            Take a selfie for identity verification. Look at the camera and ensure good lighting.
                        </Text>
                        <TouchableOpacity style={styles.cameraButton}>
                            <Text style={styles.cameraButtonText}>📷 Take Selfie</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 5:
                return (
                    <View>
                        <Text style={styles.stepTitle}>Review & Submit</Text>
                        <View style={styles.reviewCard}>
                            <Text style={styles.reviewLabel}>Name:</Text>
                            <Text style={styles.reviewValue}>{formData.fullName}</Text>
                        </View>
                        <View style={styles.reviewCard}>
                            <Text style={styles.reviewLabel}>ID Number:</Text>
                            <Text style={styles.reviewValue}>{formData.nationalId}</Text>
                        </View>
                        <View style={styles.reviewCard}>
                            <Text style={styles.reviewLabel}>Date of Birth:</Text>
                            <Text style={styles.reviewValue}>{formData.dateOfBirth}</Text>
                        </View>
                        <View style={styles.reviewCard}>
                            <Text style={styles.reviewLabel}>Location:</Text>
                            <Text style={styles.reviewValue}>
                                {formData.ward}, {formData.constituency}, {formData.county}
                            </Text>
                        </View>
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Voter Registration</Text>
                <Text style={styles.stepIndicator}>Step {step} of 5</Text>
            </View>

            <View style={styles.progressBar}>
                <View style={[styles.progress, { width: `${(step / 5) * 100}%` }]} />
            </View>

            <View style={styles.content}>{renderStep()}</View>

            <View style={styles.buttonContainer}>
                {step > 1 && (
                    <TouchableOpacity style={styles.backButton} onPress={prevStep}>
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                )}

                {step < 5 ? (
                    <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
                        <Text style={styles.nextButtonText}>Next</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                        <Text style={styles.submitButtonText}>Submit Registration</Text>
                    </TouchableOpacity>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    header: {
        padding: 20,
        backgroundColor: '#7c3aed',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    stepIndicator: {
        fontSize: 14,
        color: '#e9d5ff',
    },
    progressBar: {
        height: 4,
        backgroundColor: '#e5e7eb',
    },
    progress: {
        height: '100%',
        backgroundColor: '#10b981',
    },
    content: {
        padding: 20,
    },
    stepTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        marginTop: 12,
    },
    input: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    picker: {
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    instructions: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 20,
        lineHeight: 20,
    },
    cameraButton: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#7c3aed',
    },
    cameraButtonText: {
        fontSize: 16,
        color: '#7c3aed',
        fontWeight: '600',
    },
    reviewCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
    },
    reviewLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
    },
    reviewValue: {
        fontSize: 16,
        color: '#1f2937',
        fontWeight: '500',
    },
    buttonContainer: {
        flexDirection: 'row',
        padding: 20,
        gap: 12,
    },
    backButton: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e5e7eb',
    },
    backButtonText: {
        color: '#6b7280',
        fontSize: 16,
        fontWeight: 'bold',
    },
    nextButton: {
        flex: 2,
        backgroundColor: '#7c3aed',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    submitButton: {
        flex: 1,
        backgroundColor: '#10b981',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
