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

    const features = [
        {
            icon: '📝',
            title: 'Report Issue',
            subtitle: 'Report community problems',
            screen: 'ReportIssue',
            gradient: ['#8b5cf6', '#7c3aed'],
        },
        {
            icon: '📋',
            title: 'My Issues',
            subtitle: 'Track your reports',
            screen: 'MyIssues',
            gradient: ['#06b6d4', '#0891b2'],
        },
        {
            icon: '🗳️',
            title: 'Voter Registration',
            subtitle: 'Register to vote',
            screen: 'VoterRegistration',
            gradient: ['#ec4899', '#db2777'],
        },
        {
            icon: '📢',
            title: 'Announcements',
            subtitle: 'Ward updates & news',
            screen: 'Announcements',
            gradient: ['#f59e0b', '#d97706'],
        },
        {
            icon: '🎓',
            title: 'Bursary Status',
            subtitle: 'Check application status',
            screen: 'BursaryStatus',
            gradient: ['#10b981', '#059669'],
        },
    ];

    return (
        <View style={styles.container}>
            {/* Animated Background */}
            <View style={styles.gradientBackground}>
                <View style={styles.circle1} />
                <View style={styles.circle2} />
                <View style={styles.circle3} />
            </View>

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logoCircle}>
                    <Text style={styles.logoIcon}>🏛️</Text>
                </View>
                <Text style={styles.headerTitle}>Kyamatu Ward</Text>
                <Text style={styles.headerSubtitle}>Citizen Services</Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Welcome Card */}
                <View style={styles.welcomeCard}>
                    <Text style={styles.welcomeTitle}>Welcome Back! 👋</Text>
                    <Text style={styles.welcomeText}>
                        Access all ward services from one place
                    </Text>
                </View>

                {/* Feature Cards */}
                <View style={styles.grid}>
                    {features.map((feature, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.featureCard}
                            onPress={() => navigation.navigate(feature.screen)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.cardContent}>
                                <View style={styles.iconContainer}>
                                    <Text style={styles.cardIcon}>{feature.icon}</Text>
                                </View>
                                <View style={styles.cardText}>
                                    <Text style={styles.cardTitle}>{feature.title}</Text>
                                    <Text style={styles.cardSubtitle}>{feature.subtitle}</Text>
                                </View>
                                <Text style={styles.cardArrow}>→</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Info Card */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>📞 Contact Information</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Ward Office:</Text>
                        <Text style={styles.infoValue}>+254 XXX XXX XXX</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Email:</Text>
                        <Text style={styles.infoValue}>kyamatu@ward.go.ke</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Hours:</Text>
                        <Text style={styles.infoValue}>Mon-Fri, 8AM - 5PM</Text>
                    </View>
                </View>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutIcon}>🚪</Text>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Powered by VOO Ward Services</Text>
                </View>
            </ScrollView>
        </View>
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
        opacity: 0.2,
        top: -100,
        right: -50,
    },
    circle2: {
        position: 'absolute',
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: '#ec4899',
        opacity: 0.15,
        bottom: 100,
        left: -60,
    },
    circle3: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#06b6d4',
        opacity: 0.2,
        top: '50%',
        right: -40,
    },
    header: {
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: 20,
    },
    logoCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(124, 58, 237, 0.2)',
        borderWidth: 2,
        borderColor: 'rgba(124, 58, 237, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    logoIcon: {
        fontSize: 30,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#94a3b8',
        letterSpacing: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    welcomeCard: {
        backgroundColor: 'rgba(124, 58, 237, 0.15)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.3)',
    },
    welcomeTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 6,
    },
    welcomeText: {
        fontSize: 14,
        color: '#cbd5e1',
    },
    grid: {
        gap: 16,
    },
    featureCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: 'rgba(124, 58, 237, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardIcon: {
        fontSize: 24,
    },
    cardText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 13,
        color: '#94a3b8',
    },
    cardArrow: {
        fontSize: 20,
        color: '#7c3aed',
        fontWeight: 'bold',
    },
    infoCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: 20,
        marginTop: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    infoLabel: {
        fontSize: 14,
        color: '#94a3b8',
    },
    infoValue: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '500',
    },
    logoutButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderRadius: 16,
        padding: 18,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    logoutIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    logoutText: {
        color: '#fca5a5',
        fontSize: 16,
        fontWeight: 'bold',
    },
    footer: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    footerText: {
        color: '#64748b',
        fontSize: 12,
        letterSpacing: 0.5,
    },
});
