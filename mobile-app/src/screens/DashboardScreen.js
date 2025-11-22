import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
} from 'react-native';

export default function DashboardScreen({ navigation, onLogout }) {
    const menuItems = [
        {
            icon: '📋',
            title: 'Report Issue',
            description: 'Report roads, water, security issues',
            screen: 'ReportIssue',
        },
        {
            icon: '📊',
            title: 'My Issues',
            description: 'Track your reported issues',
            screen: 'MyIssues',
        },
        {
            icon: '🎓',
            title: 'Bursary Status',
            description: 'Check bursary applications',
            screen: 'BursaryStatus',
        },
    ];

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', onPress: onLogout, style: 'destructive' },
            ]
        );
    };

    return (
        <View style={styles.container}>
            <ScrollView style={styles.content}>
                <View style={styles.grid}>
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.card}
                            onPress={() => navigation.navigate(item.screen)}
                        >
                            <Text style={styles.cardIcon}>{item.icon}</Text>
                            <Text style={styles.cardTitle}>{item.title}</Text>
                            <Text style={styles.cardDescription}>{item.description}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>📞 Contact Information</Text>
                    <Text style={styles.infoText}>Ward Office: +254 XXX XXX XXX</Text>
                    <Text style={styles.infoText}>Email: kyamatu@ward.go.ke</Text>
                    <Text style={styles.infoText}>Hours: Mon-Fri, 8AM - 5PM</Text>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    content: {
        flex: 1,
    },
    grid: {
        padding: 16,
        gap: 16,
    },
    card: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    cardIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 14,
        color: '#6b7280',
    },
    infoCard: {
        backgroundColor: '#fff',
        padding: 20,
        margin: 16,
        borderRadius: 12,
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#4b5563',
        marginBottom: 4,
    },
    logoutButton: {
        backgroundColor: '#ef4444',
        padding: 16,
        margin: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    logoutText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
