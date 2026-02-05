import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EnhancedIssueDetailScreen({ route, navigation }) {
    const { ticketId } = route.params;
    const [issue, setIssue] = useState(null);
    const [loading, setLoading] = useState(true);
    const [comment, setComment] = useState('');
    const [hasUpvoted, setHasUpvoted] = useState(false);

    useEffect(() => {
        fetchIssueDetail();
    }, []);

    const fetchIssueDetail = async () => {
        try {
            // TODO: Replace with actual API call
            const mockIssue = {
                id: 1,
                ticket: ticketId,
                category: 'Water',
                description: 'Burst pipe on Main Street causing flooding',
                status: 'in_progress',
                location: 'Kileleshwa',
                photo_url: null,
                created_at: new Date().toISOString(),
                upvotes: 12,
                views: 45,
                comments: [
                    {
                        id: 1,
                        userName: 'Admin',
                        userRole: 'admin',
                        text: 'We have dispatched a team to fix this issue.',
                        createdAt: new Date().toISOString(),
                    },
                ],
                timeline: [
                    {
                        status: 'open',
                        date: new Date().toISOString(),
                        description: 'Issue reported',
                    },
                    {
                        status: 'acknowledged',
                        date: new Date().toISOString(),
                        description: 'Issue acknowledged by admin',
                    },
                    {
                        status: 'in_progress',
                        date: new Date().toISOString(),
                        description: 'Team dispatched to location',
                    },
                ],
            };
            setIssue(mockIssue);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch issue:', error);
            setLoading(false);
        }
    };

    const handleUpvote = async () => {
        if (hasUpvoted) return;

        try {
            // TODO: API call to upvote
            setIssue({ ...issue, upvotes: issue.upvotes + 1 });
            setHasUpvoted(true);
        } catch (error) {
            console.error('Failed to upvote:', error);
        }
    };

    const handleAddComment = async () => {
        if (!comment.trim()) return;

        try {
            const user = JSON.parse(await AsyncStorage.getItem('user'));
            const newComment = {
                id: issue.comments.length + 1,
                userName: user.phone_number,
                userRole: 'citizen',
                text: comment,
                createdAt: new Date().toISOString(),
            };

            setIssue({
                ...issue,
                comments: [...issue.comments, newComment],
            });
            setComment('');
        } catch (error) {
            console.error('Failed to add comment:', error);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            open: '#f59e0b',
            acknowledged: '#3b82f6',
            in_progress: '#8b5cf6',
            resolved: '#10b981',
            closed: '#6b7280',
        };
        return colors[status] || colors.open;
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#7c3aed" />
            </View>
        );
    }

    if (!issue) {
        return (
            <View style={styles.centered}>
                <Text>Issue not found</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.ticket}>{issue.ticket}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(issue.status) }]}>
                        <Text style={styles.statusText}>{issue.status.replace('_', ' ')}</Text>
                    </View>
                </View>

                {/* Engagement Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{issue.views}</Text>
                        <Text style={styles.statLabel}>👁️ Views</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{issue.upvotes}</Text>
                        <Text style={styles.statLabel}>👍 Upvotes</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{issue.comments.length}</Text>
                        <Text style={styles.statLabel}>💬 Comments</Text>
                    </View>
                </View>

                {/* Issue Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Issue Details</Text>
                    <Text style={styles.category}>📋 {issue.category}</Text>
                    <Text style={styles.description}>{issue.description}</Text>
                    <Text style={styles.location}>📍 {issue.location}</Text>
                </View>

                {/* Timeline */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Timeline</Text>
                    {issue.timeline.map((item, index) => (
                        <View key={index} style={styles.timelineItem}>
                            <View style={[styles.timelineDot, { backgroundColor: getStatusColor(item.status) }]} />
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineStatus}>{item.status.replace('_', ' ')}</Text>
                                <Text style={styles.timelineDescription}>{item.description}</Text>
                                <Text style={styles.timelineDate}>
                                    {new Date(item.date).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Comments */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Comments ({issue.comments.length})</Text>
                    {issue.comments.map((c) => (
                        <View key={c.id} style={styles.comment}>
                            <View style={styles.commentHeader}>
                                <Text style={styles.commentAuthor}>{c.userName}</Text>
                                <Text style={styles.commentRole}>{c.userRole}</Text>
                            </View>
                            <Text style={styles.commentText}>{c.text}</Text>
                            <Text style={styles.commentDate}>
                                {new Date(c.createdAt).toLocaleDateString()}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Upvote Button */}
                <TouchableOpacity
                    style={[styles.upvoteButton, hasUpvoted && styles.upvoteButtonActive]}
                    onPress={handleUpvote}
                    disabled={hasUpvoted}
                >
                    <Text style={styles.upvoteButtonText}>
                        {hasUpvoted ? '✓ Upvoted' : '👍 Upvote This Issue'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Add Comment Input */}
            <View style={styles.commentInputContainer}>
                <TextInput
                    style={styles.commentInput}
                    placeholder="Add a comment..."
                    value={comment}
                    onChangeText={setComment}
                    multiline
                />
                <TouchableOpacity style={styles.sendButton} onPress={handleAddComment}>
                    <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    ticket: {
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
    statsRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    stat: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    statLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    section: {
        backgroundColor: '#fff',
        padding: 20,
        marginTop: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 16,
    },
    category: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7c3aed',
        marginBottom: 8,
    },
    description: {
        fontSize: 16,
        color: '#374151',
        lineHeight: 24,
        marginBottom: 12,
    },
    location: {
        fontSize: 14,
        color: '#6b7280',
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 4,
        marginRight: 12,
    },
    timelineContent: {
        flex: 1,
    },
    timelineStatus: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2937',
        textTransform: 'capitalize',
    },
    timelineDescription: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    timelineDate: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 4,
    },
    comment: {
        backgroundColor: '#f9fafb',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    commentAuthor: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2937',
        marginRight: 8,
    },
    commentRole: {
        fontSize: 12,
        color: '#7c3aed',
        backgroundColor: '#ede9fe',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    commentText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
    },
    commentDate: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 4,
    },
    upvoteButton: {
        backgroundColor: '#7c3aed',
        padding: 16,
        margin: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    upvoteButtonActive: {
        backgroundColor: '#10b981',
    },
    upvoteButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    commentInputContainer: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        alignItems: 'center',
    },
    commentInput: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        padding: 12,
        borderRadius: 20,
        marginRight: 8,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: '#7c3aed',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 20,
    },
    sendButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});
