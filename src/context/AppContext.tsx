import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  UserRole,
  Community,
  Skill,
  CommunityPost,
  PostComment,
  XPTask,
  XPLeaderboardEntry,
  SeasonRewardItem,
  SeasonCycleInfo,
  CommunityEvent,
} from '../types';
import { Ionicons } from '@expo/vector-icons';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { DEMO_USERS, ALL_COMMUNITIES, SKILLS_CATALOG, TRENDING_POSTS } from '../data/mockData';
import {
  CURRENT_SEASON,
  MENTOR_LEADERBOARD,
  LEARNER_LEADERBOARD,
  INITIAL_XP_TASKS,
  SEASON_REWARDS,
} from '../data/rewardsData';
import { ALL_COMMUNITY_EVENTS } from '../data/eventsData';
import { UserProfileData } from '../components/common/UserProfileModal';

export interface AppDialogConfig {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  confirmText?: string;
  cancelText?: string | null;
  isDestructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AddCommentPayload {
  text: string;
  isMentorCritique?: boolean;
  commentType?: 'general' | 'mentor';
  mentorRating?: number;
  critiqueFocus?: string;
  videoCritiqueThumbnail?: string;
  videoCritiqueDuration?: string;
  videoCritiqueTitle?: string;
}

interface CreatePostPayload {
  title?: string;
  communityId?: string;
  communityIds?: string[];
  content: string;
  tag: string;
  tags?: string[];
  postType: 'text' | 'video' | 'critique_request';
  videoThumbnail?: string;
  videoDuration?: string;
  isPrivate?: boolean;
  focusArea?: string;
}

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  selectedHobby: string;
  joinedCommunities: string[];
  selectedRole: UserRole | null;
  posts: CommunityPost[];
  selectedProfileUser: UserProfileData | null;
  openUserProfile: (profile: UserProfileData) => void;
  closeUserProfile: () => void;
  // Rewards & XP Leaderboards
  isRewardsModalOpen: boolean;
  openRewardsModal: () => void;
  closeRewardsModal: () => void;
  xpTasks: XPTask[];
  mentorLeaderboard: XPLeaderboardEntry[];
  learnerLeaderboard: XPLeaderboardEntry[];
  seasonCycle: SeasonCycleInfo;
  seasonRewards: SeasonRewardItem[];
  claimXPTask: (taskId: string) => { earnedXP: number; taskTitle: string } | null;
  activeRewardClaimModal: SeasonRewardItem | null;
  openRewardClaimModal: (reward: SeasonRewardItem) => void;
  closeRewardClaimModal: () => void;
  // Community Events
  communityEvents: CommunityEvent[];
  joinCommunityEvent: (eventId: string) => void;
  completeCommunityEvent: (eventId: string) => { earnedXP: number; eventTitle: string; bonusReward?: string } | null;
  // Auth & General
  login: (identifier: string, pass: string) => boolean;
  quickLogin: (demoUser: User) => void;
  signup: (data: {
    name: string;
    phone: string;
    email: string;
    password?: string;
    dob: string;
    hobby: string;
    avatarUrl?: string;
  }) => void;
  updateUser: (data: Partial<User>) => void;
  toggleCommunityJoin: (communityId: string) => void;
  toggleLikePost: (postId: string) => void;
  toggleSavePost: (postId: string) => void;
  toggleLikeComment: (postId: string, commentId: string) => void;
  addCommentToPost: (postId: string, payload: AddCommentPayload) => void;
  createPost: (payload: CreatePostPayload) => void;
  setRole: (role: UserRole) => void;
  logout: () => void;
  getRecommendedCommunities: () => Community[];
  getSkillsForUser: () => Skill[];
  getJoinedCommunityObjects: () => Community[];
  showDialog: (config: AppDialogConfig) => void;
  hideDialog: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(DEMO_USERS[0]); // Anshuman Sarkar with Music
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [selectedHobby, setSelectedHobby] = useState<string>('Music');
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>(['comm-music-2', 'comm-music-1']);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>('Learner');
  const [posts, setPosts] = useState<CommunityPost[]>(TRENDING_POSTS);
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserProfileData | null>(null);
  const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false);
  const [xpTasks, setXpTasks] = useState<XPTask[]>(INITIAL_XP_TASKS);
  const [mentorLeaderboard, setMentorLeaderboard] = useState<XPLeaderboardEntry[]>(MENTOR_LEADERBOARD);
  const [learnerLeaderboard, setLearnerLeaderboard] = useState<XPLeaderboardEntry[]>(LEARNER_LEADERBOARD);
  const [seasonCycle] = useState<SeasonCycleInfo>(CURRENT_SEASON);
  const [seasonRewards] = useState<SeasonRewardItem[]>(SEASON_REWARDS);
  const [activeRewardClaimModal, setActiveRewardClaimModal] = useState<SeasonRewardItem | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [activeDialog, setActiveDialog] = useState<AppDialogConfig | null>(null);

  const showDialog = (config: AppDialogConfig) => {
    setActiveDialog(config);
  };

  const hideDialog = () => {
    setActiveDialog(null);
  };

  const openRewardsModal = () => {
    setIsRewardsModalOpen(true);
  };

  const closeRewardsModal = () => {
    setIsRewardsModalOpen(false);
  };

  const openRewardClaimModal = (reward: SeasonRewardItem) => {
    setActiveRewardClaimModal(reward);
  };

  const closeRewardClaimModal = () => {
    setActiveRewardClaimModal(null);
  };

  const claimXPTask = (taskId: string): { earnedXP: number; taskTitle: string } | null => {
    let earnedXP = 0;
    let taskTitle = '';

    const target = xpTasks.find((t) => t.id === taskId);
    if (!target || target.completed) return null;

    earnedXP = target.xpReward;
    taskTitle = target.title;

    setXpTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: true, claimable: false } : t))
    );

    // Update User XP
    setUser((prev) => {
      if (!prev) return prev;
      const updatedXP = (prev.xpPoints || 1240) + earnedXP;
      return { ...prev, xpPoints: updatedXP };
    });

    // Update Leaderboard dynamically
    setLearnerLeaderboard((prev) => {
      const updated = prev.map((item) => {
        if (item.isCurrentUser) {
          return { ...item, xpPoints: item.xpPoints + earnedXP };
        }
        return item;
      });
      // Sort descending by XP points and update ranks
      updated.sort((a, b) => b.xpPoints - a.xpPoints);
      return updated.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
    });

    return { earnedXP, taskTitle };
  };

  const [communityEvents, setCommunityEvents] = useState<CommunityEvent[]>(ALL_COMMUNITY_EVENTS);

  const joinCommunityEvent = (eventId: string) => {
    setCommunityEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          return {
            ...e,
            isJoined: true,
            participantsCount: e.participantsCount + 1,
          };
        }
        return e;
      })
    );
  };

  const completeCommunityEvent = (
    eventId: string
  ): { earnedXP: number; eventTitle: string; bonusReward?: string } | null => {
    let earnedXP = 0;
    let eventTitle = '';
    let bonusReward: string | undefined = undefined;

    const target = communityEvents.find((e) => e.id === eventId);
    if (!target || target.isCompleted) return null;

    earnedXP = target.xpReward;
    eventTitle = target.title;
    bonusReward = target.bonusReward;

    setCommunityEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          return {
            ...e,
            isJoined: true,
            isCompleted: true,
          };
        }
        return e;
      })
    );

    // Update User XP
    setUser((prev) => {
      if (!prev) return prev;
      const updatedXP = (prev.xpPoints || 1240) + earnedXP;
      return { ...prev, xpPoints: updatedXP };
    });

    // Update Leaderboard dynamically
    setLearnerLeaderboard((prev) => {
      const updated = prev.map((item) => {
        if (item.isCurrentUser) {
          return { ...item, xpPoints: item.xpPoints + earnedXP };
        }
        return item;
      });
      updated.sort((a, b) => b.xpPoints - a.xpPoints);
      return updated.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
    });

    return { earnedXP, eventTitle, bonusReward };
  };

  const openUserProfile = (profile: UserProfileData) => {
    setSelectedProfileUser(profile);
  };

  const closeUserProfile = () => {
    setSelectedProfileUser(null);
  };

  useEffect(() => {
    if (user) {
      if (user.hobby) setSelectedHobby(user.hobby);
      if (user.joinedCommunities) setJoinedCommunities(user.joinedCommunities);
      if (user.role) setSelectedRole(user.role);
    }
  }, [user]);

  const login = (identifier: string, pass: string): boolean => {
    const trimmed = identifier.trim().toLowerCase();
    const trimmedPass = pass.trim();

    // Check registered accounts first
    const matchedRegistered = registeredUsers.find(
      (u) =>
        (u.email.toLowerCase() === trimmed ||
          u.phone.replace(/\s+/g, '') === trimmed.replace(/\s+/g, '') ||
          u.name.toLowerCase() === trimmed) &&
        (!u.password || !trimmedPass || u.password === trimmedPass)
    );

    if (matchedRegistered) {
      setUser(matchedRegistered);
      setSelectedHobby(matchedRegistered.hobby);
      setJoinedCommunities(matchedRegistered.joinedCommunities);
      setSelectedRole(matchedRegistered.role || 'Learner');
      setIsAuthenticated(true);
      return true;
    }

    // Check any registered user by email or phone
    const matchedUserOnly = registeredUsers.find(
      (u) =>
        u.email.toLowerCase() === trimmed ||
        u.phone.replace(/\s+/g, '') === trimmed.replace(/\s+/g, '')
    );

    if (matchedUserOnly) {
      setUser(matchedUserOnly);
      setSelectedHobby(matchedUserOnly.hobby);
      setJoinedCommunities(matchedUserOnly.joinedCommunities);
      setSelectedRole(matchedUserOnly.role || 'Learner');
      setIsAuthenticated(true);
      return true;
    }

    // Check mock demo accounts
    const matched = DEMO_USERS.find(
      (u) =>
        u.email.toLowerCase() === trimmed ||
        u.phone.replace(/\s+/g, '') === trimmed.replace(/\s+/g, '') ||
        u.name.toLowerCase().includes(trimmed)
    );

    if (matched) {
      setUser(matched);
      setSelectedHobby(matched.hobby);
      setJoinedCommunities(matched.joinedCommunities);
      setSelectedRole(matched.role || 'Learner');
      setIsAuthenticated(true);
      return true;
    }

    if (trimmed.length > 0) {
      const fallbackUser: User = {
        id: `user-${Date.now()}`,
        name: identifier.includes('@') ? identifier.split('@')[0] : identifier,
        email: identifier.includes('@') ? identifier : `${identifier}@example.com`,
        phone: identifier.startsWith('+') || /^\d+$/.test(identifier) ? identifier : '+91 98765 43210',
        password: trimmedPass,
        dob: '2000-01-01',
        hobby: 'Music',
        role: 'Learner',
        joinedCommunities: ['comm-music-2', 'comm-music-1'],
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
        streakDays: 1,
        xpPoints: 1240,
        levelBadge: 'Rising Vocalist',
      };

      setRegisteredUsers((prev) => [fallbackUser, ...prev]);
      setUser(fallbackUser);
      setSelectedHobby(fallbackUser.hobby);
      setJoinedCommunities(fallbackUser.joinedCommunities);
      setSelectedRole('Learner');
      setIsAuthenticated(true);
      return true;
    }

    return false;
  };

  const quickLogin = (demoUser: User) => {
    setUser(demoUser);
    setSelectedHobby(demoUser.hobby);
    setJoinedCommunities(demoUser.joinedCommunities);
    setSelectedRole(demoUser.role || 'Learner');
    setIsAuthenticated(true);
  };

  const signup = (data: {
    name: string;
    phone: string;
    email: string;
    password?: string;
    dob: string;
    hobby: string;
    avatarUrl?: string;
  }) => {
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: data.password,
      dob: data.dob,
      hobby: data.hobby,
      joinedCommunities: [],
      role: undefined,
      avatarUrl:
        data.avatarUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
      streakDays: 1,
      xpPoints: 100,
      levelBadge: 'Novice Pioneer',
    };

    setRegisteredUsers((prev) => [newUser, ...prev]);
    setUser(newUser);
    setSelectedHobby(data.hobby);
    setJoinedCommunities([]);
    setSelectedRole(null);
    setIsAuthenticated(false);
  };

  const updateUser = (data: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : null));
    if (data.hobby) setSelectedHobby(data.hobby);
    if (data.role) setSelectedRole(data.role);
  };

  const toggleCommunityJoin = (communityId: string) => {
    setJoinedCommunities((prev) => {
      const exists = prev.includes(communityId);
      const updated = exists ? prev.filter((id) => id !== communityId) : [...prev, communityId];
      if (user) {
        setUser({ ...user, joinedCommunities: updated });
      }
      return updated;
    });
  };

  const toggleLikePost = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isLiked = !p.isLiked;
          return {
            ...p,
            isLiked,
            likesCount: isLiked ? p.likesCount + 1 : p.likesCount - 1,
          };
        }
        return p;
      })
    );
  };

  const toggleSavePost = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            isSaved: !p.isSaved,
          };
        }
        return p;
      })
    );
  };

  const toggleLikeComment = (postId: string, commentId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId && p.comments) {
          const updatedComments = p.comments.map((c) => {
            if (c.id === commentId) {
              const isLiked = !c.isLiked;
              return {
                ...c,
                isLiked,
                likesCount: isLiked ? c.likesCount + 1 : c.likesCount - 1,
              };
            }
            return c;
          });
          return { ...p, comments: updatedComments };
        }
        return p;
      })
    );
  };

  const addCommentToPost = (postId: string, payload: AddCommentPayload) => {
    const isMentorCritique = payload.isMentorCritique || payload.commentType === 'mentor';
    const isMentor = user?.role === 'Mentor' || isMentorCritique;
    const newComment: PostComment = {
      id: `comment-${Date.now()}`,
      postId,
      authorName: user?.name || (isMentor ? 'Alex Rivera (Mentor)' : 'Anshuman Sarkar'),
      authorRole: isMentor ? 'Mentor' : 'Learner',
      authorAvatar: user?.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      timeAgo: 'Just now',
      text: payload.text,
      commentType: isMentorCritique ? 'mentor' : 'general',
      isMentorCritique,
      mentorRating: payload.mentorRating || (isMentorCritique ? 5 : undefined),
      critiqueFocus: payload.critiqueFocus,
      videoCritiqueThumbnail: payload.videoCritiqueThumbnail,
      videoCritiqueDuration: payload.videoCritiqueDuration,
      videoCritiqueTitle: payload.videoCritiqueTitle,
      likesCount: 1,
      isLiked: true,
    };

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const existing = p.comments || [];
          return {
            ...p,
            commentsCount: p.commentsCount + 1,
            generalCommentsCount: !isMentorCritique
              ? (p.generalCommentsCount || 0) + 1
              : p.generalCommentsCount || 0,
            mentorCritiqueCount: isMentorCritique
              ? (p.mentorCritiqueCount || 0) + 1
              : p.mentorCritiqueCount || 0,
            comments: [newComment, ...existing],
          };
        }
        return p;
      })
    );
  };

  const createPost = (payload: CreatePostPayload) => {
    const isPrivate = !!payload.isPrivate;

    // Target communities for both public and private posts
    const targetIds =
      payload.communityIds && payload.communityIds.length > 0
        ? payload.communityIds
        : payload.communityId
        ? [payload.communityId]
        : [];

    const matchedComms = ALL_COMMUNITIES.filter((c) => targetIds.includes(c.id));
    const primaryComm = matchedComms[0] || ALL_COMMUNITIES[0];
    const communityName =
      targetIds.length === 0
        ? isPrivate
          ? 'Private Vault 🔒'
          : 'General Circle'
        : matchedComms.length > 1
        ? `${matchedComms[0].name} (+${matchedComms.length - 1} groups)`
        : primaryComm.name;

    const tagsArray = payload.tags && payload.tags.length > 0 ? payload.tags : [payload.tag || '#PracticeVideo'];
    const tagString = tagsArray.join(' ');

    const newPost: CommunityPost = {
      id: `post-${Date.now()}`,
      communityId: targetIds.length > 0 ? primaryComm.id : (isPrivate ? 'private-vault' : 'comm-general'),
      communityName,
      communityIds: targetIds,
      communityNames: matchedComms.map((c) => c.name),
      authorName: user?.name || 'Anshuman Sarkar',
      authorRole: user?.role || 'Learner',
      authorSkill: primaryComm.category || selectedHobby || 'Music',
      authorAvatar: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      timeAgo: 'Just now',
      videoTitle: payload.title || (payload.postType === 'video' ? 'New Practice Video' : undefined),
      content: payload.content,
      tag: tagString,
      tags: tagsArray,
      postType: payload.postType,
      videoThumbnail: payload.videoThumbnail,
      videoDuration: payload.videoDuration,
      viewsCount: 1,
      likesCount: 1,
      commentsCount: 0,
      mentorCritiqueCount: 0,
      isLiked: true,
      isPrivate,
      focusArea: payload.focusArea,
      comments: [],
    };

    setPosts((prev) => [newPost, ...prev]);
  };

  const setRole = (role: UserRole) => {
    setSelectedRole(role);
    if (user) {
      setUser({ ...user, role });
    }
    setIsAuthenticated(true);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setSelectedHobby('Coding');
    setJoinedCommunities([]);
    setSelectedRole(null);
  };

  const getRecommendedCommunities = (): Community[] => {
    const hobbyClean = (selectedHobby || 'Music').trim().toLowerCase();
    const matched = ALL_COMMUNITIES.filter(
      (c) => c.category.toLowerCase() === hobbyClean
    );
    return matched.length > 0 ? matched : ALL_COMMUNITIES.slice(0, 4);
  };

  const getSkillsForUser = (): Skill[] => {
    const hobbyClean = selectedHobby || 'Music';
    if (SKILLS_CATALOG[hobbyClean]) {
      return SKILLS_CATALOG[hobbyClean];
    }
    const key = Object.keys(SKILLS_CATALOG).find(
      (k) => k.toLowerCase() === hobbyClean.toLowerCase()
    );
    return key ? SKILLS_CATALOG[key] : SKILLS_CATALOG.Default;
  };

  const getJoinedCommunityObjects = (): Community[] => {
    if (joinedCommunities.length === 0) {
      return ALL_COMMUNITIES.slice(0, 2);
    }
    return ALL_COMMUNITIES.filter((c) => joinedCommunities.includes(c.id));
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated,
        selectedHobby,
        joinedCommunities,
        selectedRole,
        posts,
        selectedProfileUser,
        openUserProfile,
        closeUserProfile,
        isRewardsModalOpen,
        openRewardsModal,
        closeRewardsModal,
        xpTasks,
        mentorLeaderboard,
        learnerLeaderboard,
        seasonCycle,
        seasonRewards,
        claimXPTask,
        activeRewardClaimModal,
        openRewardClaimModal,
        closeRewardClaimModal,
        communityEvents,
        joinCommunityEvent,
        completeCommunityEvent,
        login,
        quickLogin,
        signup,
        updateUser,
        toggleCommunityJoin,
        toggleLikePost,
        toggleSavePost,
        toggleLikeComment,
        addCommentToPost,
        createPost,
        setRole,
        logout,
        getRecommendedCommunities,
        getSkillsForUser,
        getJoinedCommunityObjects,
        showDialog,
        hideDialog,
      }}
    >
      {children}
      {activeDialog && (
        <ConfirmModal
          visible={!!activeDialog}
          title={activeDialog.title}
          message={activeDialog.message}
          icon={activeDialog.icon || 'checkmark-circle-outline'}
          confirmText={activeDialog.confirmText || 'Got it'}
          cancelText={activeDialog.cancelText || undefined}
          isDestructive={activeDialog.isDestructive}
          onConfirm={() => {
            if (activeDialog.onConfirm) {
              activeDialog.onConfirm();
            }
            hideDialog();
          }}
          onCancel={() => {
            if (activeDialog.onCancel) {
              activeDialog.onCancel();
            }
            hideDialog();
          }}
        />
      )}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
