import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBursaries } from '../services/api';

export default function BursaryStatusScreen() {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchBursaries();
    }, []);

    const fetchBursaries = async () => {
        try {
            const user = JSON.parse(await AsyncStorage.getItem('user'));
            const data = await getBursaries(user.phone_number);
            setApplications(data);
        } catch (error) {
            console.error('Failed to fetch bursaries:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchBursaries();
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: '#f59e0b',
            approved: '#10b981',
            rejected: '#ef4444',
            disbursed: '#3b82f6',
        };
        return colors[status] || colors.pending;
    };

    const getStatusIcon = (status) => {
        const icons = {
            pending: '⏳',
            approved: '✅',
            rejected: '❌',
            disbursed: '💰',
        };
        return icons[status] || '📄';
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#7c3aed" />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {applications.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📚</Text>
                    <Text style={styles.emptyTitle}>No Bursary Applications</Text>
                    <Text style={styles.emptyText}>
                        You haven't applied for any bursaries yet.
                    </Text>
                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>How to Apply:</Text>
                        <Text style={styles.infoText}>1. Dial *340*75# on your phone</Text>
                        <Text style={styles.infoText}>2. Select "Apply for Bursary"</Text>
                        <Text style={styles.infoText}>3. Follow the prompts</Text>
                        <Text style={styles.infoText}>4. Check status here anytime</Text>
                    </View>
                </View>
            ) : (
                applications.map((app) => (
                    <View key={app.id} style={styles.card}>
                        <View style={styles.header}>
                            <Text style={styles.reference}>{app.reference}</Text>
                            <View style={[
                                styles.statusBadge,
                                { backgroundColor: getStatusColor(app.status) }
                            ]}>
                                <Text style={styles.statusText}>
                                    {getStatusIcon(app.status)} {app.status}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.detail}>
                            <Text style={styles.label}>Student Name:</Text>
                            <Text style={styles.value}>{app.student_name}</Text>
                        </View>

                        <View style={styles.detail}>
                            <Text style={styles.label}>Institution:</Text>
                            <Text style={styles.value}>{app.institution}</Text>
                        </View>

                        <View style={styles.detail}>
                            <Text style={styles.label}>Amount Requested:</Text>
                            <Text style={styles.amount}>
                                KES {app.amount.toLocaleString()}
                            </Text>
                        </View>

                        {app.approved_amount && (
                            <View style={styles.detail}>
                                <Text style={styles.label}>Approved Amount:</Text>
                                <Text style={[styles.amount, styles.approvedAmount]}>
                                    KES {app.approved_amount.toLocaleString()}
                                </Text>
                            </View>
                        )}

                        <Text style={styles.date}>
                            Applied: {new Date(app.created_at).toLocaleDateString()}
                        </Text>
                    </View>
                ))
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    infoBox: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12,
        width: '100%',
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#4b5563',
        marginBottom: 4,
    },
    card: {
        backgroundColor: '#fff',
        margin: 12,
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    reference: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#7c3aed',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    detail: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    label: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '600',
    },
    value: {
        fontSize: 14,
        color: '#1f2937',
        fontWeight: '500',
    },
    amount: {
        fontSize: 16,
        color: '#7c3aed',
        fontWeight: 'bold',
    },
    approvedAmount: {
        color: '#10b981',
    },
    date: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 12,
    },
});
