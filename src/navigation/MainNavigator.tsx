// ============================================================================
// Main Navigator — Bottom Tabs with nested stacks
// ============================================================================

import React from "react";
import { Platform } from "react-native";
import { RankingScreen } from "../screens/profile/RankingScreen";
import { BadgesScreen } from "../screens/profile/BadgesScreen";
import { CommonActions } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { colors } from "../theme/colors";
import { ExamPlayerScreen } from "../screens/exam/ExamPlayerScreen";
import { ExamResultsScreen } from "../screens/exam/ExamResultsScreen";
import { ExamHistoryScreen } from "../screens/exam/ExamHistoryScreen";
import { AiCreditsHistoryScreen } from "../screens/profile/AiCreditsHistoryScreen";
import type {
  MainTabParamList,
  HomeStackParamList,
  SubjectsStackParamList,
  QuizStackParamList,
  ProfileStackParamList,
} from "./types";

import { DashboardScreen } from "../screens/home/DashboardScreen";
import { SessionHistoryScreen } from "../screens/home/SessionHistoryScreen";
import { SubjectsScreen } from "../screens/subjects/SubjectsScreen";
import { SubjectDetailScreen } from "../screens/subjects/SubjectDetailScreen";
import { QuizSetupScreen } from "../screens/quiz/QuizSetupScreen";
import { QuizPlayScreen } from "../screens/quiz/QuizPlayScreen";
import { QuizResultScreen } from "../screens/quiz/QuizResultScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { SubscriptionScreen } from "../screens/profile/SubscriptionScreen";
import { ExamSelectorScreen } from "../screens/exam/ExamSelectorScreen";

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
function HomeStackNav() {
  const { colors: theme } = useTheme();
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <HomeStack.Screen name="Dashboard" component={DashboardScreen} />
      <HomeStack.Screen
        name="SessionHistory"
        component={SessionHistoryScreen}
      />
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
        animation: "slide_from_right",
      }}
    >
      <SubjectsStack.Screen name="SubjectsList" component={SubjectsScreen} />
      <SubjectsStack.Screen
        name="SubjectDetail"
        component={SubjectDetailScreen}
      />
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
        animation: "slide_from_right",
      }}
    >
      <QuizStack.Screen name="QuizSetup" component={QuizSetupScreen} />
      <QuizStack.Screen
        name="QuizPlay"
        component={QuizPlayScreen}
        options={{ gestureEnabled: false }}
      />
      <QuizStack.Screen
        name="QuizResult"
        component={QuizResultScreen}
        options={{ gestureEnabled: false }}
      />
    </QuizStack.Navigator>
  );
}

import type { ExamStackParamList } from "./types";

const ExamStack = createNativeStackNavigator<ExamStackParamList>();
function ExamStackNav() {
  const { colors: theme } = useTheme();
  return (
    <ExamStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: "slide_from_right",
      }}
    >
      <ExamStack.Screen name="ExamSelector" component={ExamSelectorScreen} />
      <ExamStack.Screen
        name="ExamPlay"
        component={ExamPlayerScreen}
        options={{ gestureEnabled: false }}
      />
      <ExamStack.Screen name="ExamResults" component={ExamResultsScreen} />
      <ExamStack.Screen name="ExamHistory" component={ExamHistoryScreen} />
    </ExamStack.Navigator>
  );
}

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
function ProfileStackNav() {
  const { colors: theme } = useTheme();
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: "slide_from_right",
      }}
    >
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="Subscription" component={SubscriptionScreen} />
      <ProfileStack.Screen name="Badges" component={BadgesScreen} />
      <ProfileStack.Screen name="Ranking" component={RankingScreen} />
      <ProfileStack.Screen
        name="AiCreditsHistory"
        component={AiCreditsHistoryScreen}
      />
    </ProfileStack.Navigator>
  );
}

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainNavigator() {
  const { colors: theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(
    insets.bottom,
    Platform.OS === "android" ? 8 : 0,
  );

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
          paddingTop: 10,
          paddingBottom: bottomPadding + 10,
          height: 60 + bottomPadding + 10,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        tabBarLabelStyle: { fontSize: 11, marginTop: 2 },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNav}
        options={{
          tabBarLabel: "Start",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SubjectsTab"
        component={SubjectsStackNav}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.dispatch(
              CommonActions.reset({
                index: 1,
                routes: [
                  { name: "HomeTab" },
                  {
                    name: "SubjectsTab",
                    state: {
                      routes: [{ name: "SubjectsList" }],
                    },
                  },
                  { name: "QuizTab" },
                  { name: "ProfileTab" },
                ],
              }),
            );
          },
        })}
        options={{
          tabBarLabel: "Przedmioty",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="QuizTab"
        component={QuizStackNav}
        options={{
          tabBarLabel: "Quiz",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ExamTab"
        component={ExamStackNav}
        options={{
          tabBarLabel: "Egzamin",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNav}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.dispatch(
              CommonActions.reset({
                index: 3, // ProfileTab jest 4. tab (index 3)
                routes: [
                  { name: "HomeTab" },
                  { name: "SubjectsTab" },
                  { name: "QuizTab" },
                  {
                    name: "ProfileTab",
                    state: {
                      routes: [{ name: "ProfileMain" }],
                    },
                  },
                ],
              }),
            );
          },
        })}
        options={{
          tabBarLabel: "Profil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
