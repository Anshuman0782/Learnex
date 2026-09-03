import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  HomeTab: undefined;
  CommunityTab: undefined;
  AddTab: undefined;
  FeedTab: undefined;
  ProfileTab: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  CommunityRecommendation: undefined;
  RoleSelection: undefined;
  MentorQuiz: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};
