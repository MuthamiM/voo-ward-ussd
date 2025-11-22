import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
    Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createIssue, uploadPhoto } from '../services/api';

export default function ReportIssueScreen({ navigation }) {
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [photoUri, setPhotoUri] = useState(null);
    const [loading, setLoading] = useState(false);

    const categories = [
        'Roads & Infrastructure',
        'Water & Sanitation',
        'Security',
        'Health Services',
        'Education',
        'Electricity',
        'Waste Management',
        'Other',
    ];

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant camera roll permissions');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });

        if (!result.canceled) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant camera permissions');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });

        if (!result.canceled) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!category || !description) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            const user = JSON.parse(await AsyncStorage.getItem('user'));

            let photoUrl = null;
            if (photoUri) {
                const uploadResult = await uploadPhoto(photoUri);
                photoUrl = uploadResult.url;
            }

            const issueData = {
                category,
                description,
                location,
                photo_url: photoUrl,
            };

            const result = await createIssue(issueData, user.phone_number);

            Alert.alert(
                'Success!',
                `Issue reported successfully!\nTicket: ${result.ticket}`,
                [
                    { text: 'View My Issues', onPress: () => navigation.navigate('MyIssues') },
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]
            );
        } catch (error) {
            Alert.alert('Error', error.response?.data?.detail || 'Failed to submit issue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.label}>Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {categories.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.categoryChip,
                                category === cat && styles.categoryChipActive,
                            ]}
                            onPress={() => setCategory(cat)}
                        >
                            <Text style={[
                                styles.categoryText,
                                category === cat && styles.categoryTextActive,
                            ]}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={styles.label}>Description *</Text>
                <TextInput
                    style={styles.textArea}
                    placeholder="Describe the issue in detail..."
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={5}
                />

                <Text style={styles.label}>Location</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g., Near Chief's Office"
                    value={location}
                    onChangeText={setLocation}
                />

                <Text style={styles.label}>Photo (Optional)</Text>
                <View style={styles.photoButtons}>
                    <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                        <Text style={styles.photoButtonText}>📷 Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
                        <Text style={styles.photoButtonText}>🖼️ Choose from Gallery</Text>
                    </TouchableOpacity>
                </View>

                {photoUri && (
                    <View style={styles.photoPreview}>
                        <Image source={{ uri: photoUri }} style={styles.photo} />
                        <TouchableOpacity
                            style={styles.removePhoto}
                            onPress={() => setPhotoUri(null)}
                        >
                            <Text style={styles.removePhotoText}>✕ Remove</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit Issue</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    content: {
        padding: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 8,
        marginTop: 16,
    },
    categoryScroll: {
        marginBottom: 8,
    },
    categoryChip: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 2,
        borderColor: '#e5e7eb',
    },
    categoryChipActive: {
        backgroundColor: '#7c3aed',
        borderColor: '#7c3aed',
    },
    categoryText: {
        color: '#6b7280',
        fontSize: 14,
    },
    categoryTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    input: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    textArea: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        minHeight: 120,
        textAlignVertical: 'top',
    },
    photoButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    photoButton: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    photoButtonText: {
        fontSize: 14,
        color: '#4b5563',
    },
    photoPreview: {
        marginTop: 16,
        position: 'relative',
    },
    photo: {
        width: '100%',
        height: 200,
        borderRadius: 8,
    },
    removePhoto: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#ef4444',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    removePhotoText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    submitButton: {
        backgroundColor: '#7c3aed',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 32,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
