// ============================================================================
// Main Navigator — Bottom Tabs with nested stacks
// ============================================================================

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { radius } from '../theme';
import type {
  MainTabParamList,
  HomeStackParamList,
  SubjectsStackParamList,
  QuizStackParamList,
  ProfileStackParamList,
} from './types';

// Screens
import { DashboardScreen } from '../screens/home/DashboardScreen';
import { SubjectsScreen } from '../screens/subjects/SubjectsScreen';
import { SubjectDetailScreen } from '../screens/subjects/SubjectDetailScreen';
import { QuizSetupScreen } from '../screens/quiz/QuizSetupScreen';
import { QuizPlayScreen } from '../screens/quiz/QuizPlayScreen';
import { QuizResultScreen } from '../screens/quiz/QuizResultScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

// ── Nested Stacks ─────────────────────────────────────────────────────────

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
function HomeStackNav() {
  const { colors: theme } = useTheme();
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <HomeStack.Screen name="Dashboard" component={DashboardScreen} />
    </HomeStack.Navigator>
  );
}

const SubjectsStack = createNativeStackNavigator<SubjectsStackParamList>();
function SubjectsStackNav() {
  const { colors: theme } = useTheme();
  return (
    <SubjectsStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'slide_from_right',
      }}
    >
      <SubjectsStack.Screen name="SubjectsList" component={SubjectsScreen} />
      <SubjectsStack.Screen name="SubjectDetail" component={SubjectDetailScreen} />
    </SubjectsStack.Navigator>
  );
}

const QuizStack = createNativeStackNavigator<QuizStackParamList>();
function QuizStackNav() {
  const { colors: theme } = useTheme();
  return (
    <QuizStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'slide_from_right',
      }}
    >
      <QuizStack.Screen name="QuizSetup" component={QuizSetupScreen} />
      <QuizStack.Screen name="QuizPlay" component={QuizPlayScreen} options={{ gestureEnabled: false }} />
      <QuizStack.Screen name="QuizResult" component={QuizResultScreen} options={{ gestureEnabled: false }} />
    </QuizStack.Navigator>
  );
}

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
function ProfileStackNav() {
  const { colors: theme } = useTheme();
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
    </ProfileStack.Navigator>
  );
}

// ── Bottom Tabs ───────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainNavigator() {
  const { colors: theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand[500],
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontFamily: 'Outfit_500Medium',
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNav}
        options={{
          tabBarLabel: 'Start',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SubjectsTab"
        component={SubjectsStackNav}
        options={{
          tabBarLabel: 'Przedmioty',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="QuizTab"
        component={QuizStackNav}
        options={{
          tabBarLabel: 'Quiz',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNav}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
