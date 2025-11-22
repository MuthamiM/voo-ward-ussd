import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';

export default function AnnouncementsScreen() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            // TODO: Replace with actual API call
            const mockAnnouncements = [
                {
                    id: 1,
                    title: 'Water Maintenance Schedule',
                    summary: 'Scheduled water maintenance in Kileleshwa area on 25th November',
                    body: 'Full details about the maintenance...',
                    priority: 'important',
                    category: 'service',
                    publishedAt: new Date().toISOString(),
                    views: 120,
                },
                {
                    id: 2,
                    title: 'Town Hall Meeting',
                    summary: 'Community town hall meeting scheduled for 30th November at 2 PM',
                    body: 'Join us for the monthly town hall...',
                    priority: 'normal',
                    category: 'event',
                    publishedAt: new Date().toISOString(),
                    views: 85,
                },
                {
                    id: 3,
                    title: 'Road Closure Alert',
                    summary: 'Main Street will be closed for repairs from 1st-5th December',
                    body: 'Please use alternative routes...',
                    priority: 'urgent',
                    category: 'alert',
                    publishedAt: new Date().toISOString(),
                    views: 200,
                },
            ];
            setAnnouncements(mockAnnouncements);
            setLoading(false);
            setRefreshing(false);
        } catch (error) {
            console.error('Failed to fetch announcements:', error);
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchAnnouncements();
    };

    const getPriorityColor = (priority) => {
        const colors = {
            normal: '#6b7280',
            important: '#f59e0b',
            urgent: '#ef4444',
        };
        return colors[priority] || colors.normal;
    };

    const getCategoryIcon = (category) => {
        const icons = {
            event: '📅',
            service: '🔧',
            alert: '⚠️',
            general: '📢',
        };
        return icons[category] || icons.general;
    };

    const filteredAnnouncements = announcements.filter((a) => {
        if (filter === 'all') return true;
        return a.category === filter;
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
            {/* Filter Tabs */}
            <View style={styles.filterBar}>
                {['all', 'event', 'service', 'alert'].map((f) => (
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
                            {f.toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Announcements List */}
            <ScrollView
                style={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {filteredAnnouncements.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyText}>No announcements</Text>
                    </View>
                ) : (
                    filteredAnnouncements.map((announcement) => (
                        <TouchableOpacity
                            key={announcement.id}
                            style={styles.card}
                            onPress={() => {
                                // Navigate to detail screen
                            }}
                        >
                            {/* Priority Indicator */}
                            {announcement.priority !== 'normal' && (
                                <View
                                    style={[
                                        styles.priorityDot,
                                        { backgroundColor: getPriorityColor(announcement.priority) },
                                    ]}
                                />
                            )}

                            {/* Header */}
                            <View style={styles.cardHeader}>
                                <Text style={styles.categoryIcon}>
                                    {getCategoryIcon(announcement.category)}
                                </Text>
                                <Text style={styles.category}>{announcement.category}</Text>
                                <Text style={styles.date}>
                                    {new Date(announcement.publishedAt).toLocaleDateString()}
                                </Text>
                            </View>

                            {/* Content */}
                            <Text style={styles.title}>{announcement.title}</Text>
                            <Text style={styles.summary} numberOfLines={2}>
                                {announcement.summary}
                            </Text>

                            {/* Footer */}
                            <View style={styles.cardFooter}>
                                <Text style={styles.views}>👁️ {announcement.views} views</Text>
                                <Text style={styles.readMore}>Read more →</Text>
                            </View>
                        </TouchableOpacity>
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
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
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
        position: 'relative',
    },
    priorityDot: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    categoryIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    category: {
        fontSize: 12,
        color: '#7c3aed',
        fontWeight: '600',
        textTransform: 'capitalize',
        flex: 1,
    },
    date: {
        fontSize: 12,
        color: '#9ca3af',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
    },
    summary: {
        fontSize: 14,
        color: '#6b7280',
        lineHeight: 20,
        marginBottom: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },
    views: {
        fontSize: 12,
        color: '#9ca3af',
    },
    readMore: {
        fontSize: 14,
        color: '#7c3aed',
        fontWeight: '600',
    },
});
