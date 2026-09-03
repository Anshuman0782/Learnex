import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { CommunityRecommendationScreen } from '../screens/onboarding/CommunityRecommendationScreen';
import { RoleSelectionScreen } from '../screens/onboarding/RoleSelectionScreen';
import { MentorQuizScreen } from '../screens/onboarding/MentorQuizScreen';
import { MainTabNavigator } from './MainTabNavigator';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen
        name="CommunityRecommendation"
        component={CommunityRecommendationScreen}
      />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="MentorQuiz" component={MentorQuizScreen} />
      <Stack.Screen name="Main" component={MainTabNavigator} />
    </Stack.Navigator>
  );
};
