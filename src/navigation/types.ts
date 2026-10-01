import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  HomeTab: undefined;
  ReelsTab: undefined;
  AddTab: { circleId?: string } | undefined;
  CirclesTab: { openCircleId?: string } | undefined;
  RankTab: undefined;
};

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  CommunityRecommendation: undefined;
  RoleSelection: undefined;
  MentorQuiz: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};
