import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Modal } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList } from './types';
import { HomeScreen } from '../screens/main/HomeScreen';
import { FeedPlaceholderScreen } from '../screens/main/FeedPlaceholderScreen';
import { AddContentPlaceholderScreen } from '../screens/main/AddContentPlaceholderScreen';
import { CommunityScreen } from '../screens/main/CommunityScreen';
import { RankScreen } from '../screens/main/RankScreen';
import { ProfilePlaceholderScreen } from '../screens/main/ProfilePlaceholderScreen';
import { colors, typography, shadows } from '../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

const CustomAddButton = ({ children, onPress }: any) => (
  <TouchableOpacity
    activeOpacity={0.85}
    style={styles.customAddButtonWrapper}
    onPress={onPress}
  >
    <View style={styles.outerHalo}>
      <LinearGradient
        colors={['#4F46E5', '#7C3AED', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.customAddButton, shadows.glow]}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </LinearGradient>
    </View>
  </TouchableOpacity>
);

import { useApp } from '../context/AppContext';
import { UserProfileModal } from '../components/common/UserProfileModal';
import { RewardsHubModal } from '../components/rewards';
import { ChatModal } from '../components/chat/ChatModal';

export const MainTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    selectedProfileUser,
    closeUserProfile,
    isRewardsModalOpen,
    closeRewardsModal,
    isMyProfileOpen,
    closeMyProfile,
  } = useApp();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="HomeTab"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: '#94A3B8',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#F1F5F9',
            height: Platform.OS === 'ios' ? 88 : 65 + insets.bottom,
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 10,
            paddingTop: 8,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
          },
          tabBarLabelStyle: {
            fontSize: typography.sizes.xs,
            fontWeight: typography.weights.medium,
            marginTop: 2,
          },
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tab.Screen
          name="ReelsTab"
          component={FeedPlaceholderScreen}
          options={{
            tabBarLabel: 'Reels',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'play-circle' : 'play-circle-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tab.Screen
          name="AddTab"
          component={AddContentPlaceholderScreen}
          options={{
            tabBarLabel: '',
            tabBarButton: (props) => <CustomAddButton {...props} />,
          }}
        />

        <Tab.Screen
          name="CirclesTab"
          component={CommunityScreen}
          options={{
            tabBarLabel: 'Circles',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'people' : 'people-outline'}
                size={23}
                color={color}
              />
            ),
          }}
        />

        <Tab.Screen
          name="RankTab"
          component={RankScreen}
          options={{
            tabBarLabel: 'Rank',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'trophy' : 'trophy-outline'}
                size={23}
                color={color}
              />
            ),
          }}
        />
      </Tab.Navigator>

      {/* Global Interactive User Profile Modal (Mentors: Book Session + Message; Members: Message Only) */}
      <UserProfileModal
        visible={!!selectedProfileUser}
        user={selectedProfileUser}
        onClose={closeUserProfile}
      />

      {/* Global real-time chat (inbox + conversations) */}
      <ChatModal />

      {/* Global Seasonal Rewards & XP Leaderboard Hub */}
      <RewardsHubModal
        visible={isRewardsModalOpen}
        onClose={closeRewardsModal}
      />

      {/* User's Own Full Profile Page */}
      <Modal
        visible={isMyProfileOpen}
        animationType="slide"
        onRequestClose={closeMyProfile}
      >
        <ProfilePlaceholderScreen onClose={closeMyProfile} />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  customAddButtonWrapper: {
    top: -22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerHalo: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customAddButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
