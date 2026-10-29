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
  VerifyEmail: { autoSend?: boolean } | undefined;
  ForgotPassword: undefined;
  CommunityRecommendation: undefined;
  RoleSelection: undefined;
  /** `skill`: test for this skill; `addSkill`: opened from the profile, not sign-up. */
  MentorQuiz: { skill?: string; addSkill?: boolean; forceQuiz?: boolean } | undefined;
  /** AI mentor test (Coding, Music, Spoken English). */
  MentorTest: { skill?: string; addSkill?: boolean } | undefined;
  AddSkill: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};
