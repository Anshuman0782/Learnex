import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';
import { CommunityRecommendationScreen } from '../screens/onboarding/CommunityRecommendationScreen';
import { RoleSelectionScreen } from '../screens/onboarding/RoleSelectionScreen';
import { MentorQuizScreen } from '../screens/onboarding/MentorQuizScreen';
import { AddSkillScreen } from '../screens/onboarding/AddSkillScreen';
import { MainTabNavigator } from './MainTabNavigator';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen
        name="CommunityRecommendation"
        component={CommunityRecommendationScreen}
      />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="MentorQuiz" component={MentorQuizScreen} />
      <Stack.Screen name="AddSkill" component={AddSkillScreen} />
      <Stack.Screen name="Main" component={MainTabNavigator} />
    </Stack.Navigator>
  );
};
