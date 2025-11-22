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
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Kyamatu Ward</Text>
                <Text style={styles.headerSubtitle}>Citizen Services</Text>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.grid}>
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => navigation.navigate('ReportIssue')}
                    >
                        <Text style={styles.cardIcon}>📝</Text>
                        <Text style={styles.cardTitle}>Report Issue</Text>
                        <Text style={styles.cardSubtitle}>Report community problems</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => navigation.navigate('MyIssues')}
                    >
                        <Text style={styles.cardIcon}>📋</Text>
                        <Text style={styles.cardTitle}>My Issues</Text>
                        <Text style={styles.cardSubtitle}>Track your reports</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => navigation.navigate('VoterRegistration')}
                    >
                        <Text style={styles.cardIcon}>🗳️</Text>
                        <Text style={styles.cardTitle}>Voter Registration</Text>
                        <Text style={styles.cardSubtitle}>Register to vote</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => navigation.navigate('Announcements')}
                    >
                        <Text style={styles.cardIcon}>📢</Text>
                        <Text style={styles.cardTitle}>Announcements</Text>
                        <Text style={styles.cardSubtitle}>Ward updates & news</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => navigation.navigate('BursaryStatus')}
                    >
                        <Text style={styles.cardIcon}>🎓</Text>
                        <Text style={styles.cardTitle}>Bursary Status</Text>
                        <Text style={styles.cardSubtitle}>Check application status</Text>
                    </TouchableOpacity>
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
    header: {
        backgroundColor: '#7c3aed',
        padding: 20,
        paddingTop: 40,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#e9d5ff',
        marginTop: 4,
    },
    content: {
        flex: 1,
    },
    grid: {
        padding: 16,
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
    cardSubtitle: {
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
        marginBottom: 32,
    },
    logoutText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
