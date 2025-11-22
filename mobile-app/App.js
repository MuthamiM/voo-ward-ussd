import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ReportIssueScreen from './src/screens/ReportIssueScreen';
import MyIssuesScreen from './src/screens/MyIssuesScreen';
import BursaryStatusScreen from './src/screens/BursaryStatusScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      setIsAuthenticated(!!token);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (token, user) => {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#7c3aed',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen
            name="Login"
            options={{ headerShown: false }}
          >
            {props => <LoginScreen {...props} onLogin={handleLogin} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen
              name="Dashboard"
              options={{ title: '🏛️ Kyamatu Ward' }}
            >
              {props => <DashboardScreen {...props} onLogout={handleLogout} />}
            </Stack.Screen>
            <Stack.Screen
              name="ReportIssue"
              component={ReportIssueScreen}
              options={{ title: 'Report Issue' }}
            />
            <Stack.Screen
              name="MyIssues"
              component={MyIssuesScreen}
              options={{ title: 'My Issues' }}
            />
            <Stack.Screen
              name="BursaryStatus"
              component={BursaryStatusScreen}
              options={{ title: 'Bursary Status' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
