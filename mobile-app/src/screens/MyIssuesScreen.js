import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Image,
    RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getIssues } from '../services/api';

export default function MyIssuesScreen() {
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchIssues();
    }, []);

    const fetchIssues = async () => {
        try {
            const user = JSON.parse(await AsyncStorage.getItem('user'));
            const data = await getIssues(user.phone_number);
            setIssues(data);
        } catch (error) {
            console.error('Failed to fetch issues:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchIssues();
    };

    const getStatusColor = (status) => {
        const colors = {
            open: '#f59e0b',
            in_progress: '#3b82f6',
            resolved: '#10b981',
            closed: '#6b7280',
        };
        return colors[status] || colors.open;
    };

    const filteredIssues = issues.filter(issue => {
        if (filter === 'all') return true;
        return issue.status === filter;
    });

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#7c3aed" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.filterBar}>
                {['all', 'open', 'in_progress', 'resolved'].map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[
                            styles.filterButton,
                            filter === f && styles.filterButtonActive,
                        ]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[
                            styles.filterText,
                            filter === f && styles.filterTextActive,
                        ]}>
                            {f.replace('_', ' ').toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView
                style={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {filteredIssues.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyText}>No issues found</Text>
                    </View>
                ) : (
                    filteredIssues.map((issue) => (
                        <View key={issue.id} style={styles.issueCard}>
                            <View style={styles.issueHeader}>
                                <Text style={styles.ticket}>{issue.ticket}</Text>
                                <View style={[
                                    styles.statusBadge,
                                    { backgroundColor: getStatusColor(issue.status) }
                                ]}>
                                    <Text style={styles.statusText}>
                                        {issue.status.replace('_', ' ')}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.category}>📋 {issue.category}</Text>
                            <Text style={styles.description}>{issue.description}</Text>

                            {issue.location && (
                                <Text style={styles.location}>📍 {issue.location}</Text>
                            )}

                            {issue.photo_url && (
                                <Image
                                    source={{ uri: issue.photo_url }}
                                    style={styles.issuePhoto}
                                />
                            )}

                            <Text style={styles.date}>
                                {new Date(issue.created_at).toLocaleDateString()}
                            </Text>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
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
    filterBar: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#fff',
        gap: 8,
    },
    filterButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
    },
    filterButtonActive: {
        backgroundColor: '#7c3aed',
    },
    filterText: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: '600',
    },
    filterTextActive: {
        color: '#fff',
    },
    list: {
        flex: 1,
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        color: '#6b7280',
    },
    issueCard: {
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
    issueHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    ticket: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#7c3aed',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    category: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#4b5563',
        marginBottom: 8,
        lineHeight: 20,
    },
    location: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 8,
    },
    issuePhoto: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        marginTop: 8,
    },
    date: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 8,
    },
});
