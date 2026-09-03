import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { Header, Button } from '../../components/common';
import { getRandomMentorQuestions } from '../../data/mentorQuizData';
import { MentorQuestion } from '../../types';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'MentorQuiz'>;

export const MentorQuizScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { setRole, selectedHobby } = useApp();

  // Pick 5 random questions for this assessment session
  const [questions, setQuestions] = useState<MentorQuestion[]>(() =>
    getRandomMentorQuestions(selectedHobby, 5)
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const currentQuestion = questions[currentIndex];
  const selectedOptionIndex = selectedAnswers[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  // Calculate score
  const score = useMemo(() => {
    let count = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        count += 1;
      }
    });
    return count;
  }, [questions, selectedAnswers]);

  const hasPassed = score >= 4; // Requirement: 4 out of 5 to qualify as Mentor

  const handleSelectOption = (optionIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionIndex,
    }));
  };

  const handleNext = () => {
    if (selectedOptionIndex === undefined) {
      Alert.alert('Select an Answer', 'Please choose an option before proceeding.');
      return;
    }

    if (!isLastQuestion) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Final submission
      const finalScore = questions.reduce(
        (acc, q, idx) => (selectedAnswers[idx] === q.correctIndex ? acc + 1 : acc),
        0
      );
      const passed = finalScore >= 4;

      if (passed) {
        setRole('Mentor');
      } else {
        setRole('Learner');
      }

      setIsCompleted(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleFinishAndEnterApp = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main', params: { screen: 'HomeTab' } }],
    });
  };

  const handleRetake = () => {
    setQuestions(getRandomMentorQuestions(selectedHobby, 5));
    setCurrentIndex(0);
    setSelectedAnswers({});
    setIsCompleted(false);
    setShowReview(false);
  };

  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  // =================== RESULT VIEW ===================
  if (isCompleted) {
    return (
      <View style={styles.container}>
        <View style={{ paddingTop: Math.max(insets.top, 12), backgroundColor: '#FFFFFF' }}>
          <Header
            title="Assessment Result"
            onBack={hasPassed ? undefined : () => navigation.goBack()}
          />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 30, 40) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Result Card */}
          <View
            style={[
              styles.resultCard,
              hasPassed ? styles.resultCardPass : styles.resultCardFail,
              shadows.card,
            ]}
          >
            <View
              style={[
                styles.resultIconCircle,
                { backgroundColor: hasPassed ? '#FEF3C7' : '#F1F5F9' },
              ]}
            >
              <Ionicons
                name={hasPassed ? 'trophy' : 'school-outline'}
                size={48}
                color={hasPassed ? '#D97706' : colors.primary}
              />
            </View>

            <View
              style={[
                styles.resultBadge,
                { backgroundColor: hasPassed ? '#DCFCE7' : '#FEF3C7' },
              ]}
            >
              <Text
                style={[
                  styles.resultBadgeText,
                  { color: hasPassed ? '#166534' : '#B45309' },
                ]}
              >
                {hasPassed ? 'QUALIFIED AS MENTOR 🎉' : 'ASSIGNED AS LEARNER 💡'}
              </Text>
            </View>

            <Text style={styles.resultTitle}>
              {hasPassed ? 'Mentor Certified!' : 'Welcome to LERNEX!'}
            </Text>

            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>
                Score: <Text style={styles.scoreNumber}>{score}</Text> / {questions.length} Correct
              </Text>
            </View>

            <Text style={styles.resultDescription}>
              {hasPassed
                ? 'Outstanding performance! You met the 4/5 qualification criteria and unlocked full Mentor privileges including video critiques and community guidance.'
                : 'You scored under 4/5 required for Mentor qualification. You have been automatically registered as a Learner so you can practice, receive mentor feedback, and level up!'}
            </Text>

            {/* Role Assignment Chip */}
            <View style={styles.assignedRoleChip}>
              <Ionicons
                name={hasPassed ? 'ribbon' : 'person'}
                size={18}
                color={hasPassed ? '#7C3AED' : colors.primary}
              />
              <Text style={styles.assignedRoleText}>
                Active Role: <Text style={{ fontWeight: 'bold' }}>{hasPassed ? 'Mentor' : 'Learner'}</Text>
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <Button
              title={hasPassed ? 'Enter App as Mentor 🚀' : 'Continue as Learner 🎓'}
              onPress={handleFinishAndEnterApp}
              fullWidth
              size="lg"
            />

            {!hasPassed && (
              <Button
                title="Retake 5-Question Test 🔄"
                onPress={handleRetake}
                variant="outline"
                fullWidth
                size="md"
                style={{ marginTop: spacing.sm }}
              />
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowReview(!showReview)}
              style={styles.reviewToggleBtn}
            >
              <Ionicons
                name={showReview ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.reviewToggleText}>
                {showReview ? 'Hide Question Breakdown' : 'Review Test Answers'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Review breakdown accordion */}
          {showReview && (
            <View style={styles.reviewList}>
              <Text style={styles.reviewHeaderTitle}>Assessment Review</Text>
              {questions.map((q, qIndex) => {
                const isCorrect = selectedAnswers[qIndex] === q.correctIndex;
                const userChoice = selectedAnswers[qIndex];
                return (
                  <View key={q.id} style={styles.reviewItemCard}>
                    <View style={styles.reviewItemHeader}>
                      <View
                        style={[
                          styles.statusIndicator,
                          { backgroundColor: isCorrect ? '#DCFCE7' : '#FEE2E2' },
                        ]}
                      >
                        <Ionicons
                          name={isCorrect ? 'checkmark' : 'close'}
                          size={14}
                          color={isCorrect ? '#166534' : '#DC2626'}
                        />
                      </View>
                      <Text style={styles.reviewItemQuestionText}>
                        Q{qIndex + 1}. {q.question}
                      </Text>
                    </View>

                    <View style={styles.reviewOptionsBox}>
                      <Text style={styles.reviewYourAnswer}>
                        Your answer:{' '}
                        <Text
                          style={{
                            color: isCorrect ? '#166534' : '#DC2626',
                            fontWeight: '600',
                          }}
                        >
                          {userChoice !== undefined ? q.options[userChoice] : 'Not answered'}
                        </Text>
                      </Text>
                      {!isCorrect && (
                        <Text style={styles.reviewCorrectAnswer}>
                          Correct:{' '}
                          <Text style={{ color: '#166534', fontWeight: '600' }}>
                            {q.options[q.correctIndex]}
                          </Text>
                        </Text>
                      )}
                      <Text style={styles.reviewExplanation}>
                        💡 {q.explanation}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // =================== QUIZ QUESTIONS VIEW ===================
  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={{ paddingTop: Math.max(insets.top, 10), backgroundColor: '#FFFFFF' }}>
        <Header
          title="Mentor Qualification"
          onBack={() => navigation.goBack()}
        />
      </View>

      {/* Progress Bar Header */}
      <View style={styles.progressBarSection}>
        <View style={styles.progressTextRow}>
          <Text style={styles.progressStepText}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
          <View style={styles.criteriaBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#7C3AED" />
            <Text style={styles.criteriaBadgeText}>Pass: 4/5 Correct</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 80, 100) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Category Pill */}
        <View style={styles.categoryPillRow}>
          <View style={styles.categoryPill}>
            <Ionicons name="sparkles" size={12} color={colors.primary} />
            <Text style={styles.categoryPillText}>
              {currentQuestion.category} • Mentorship MVP Test
            </Text>
          </View>
        </View>

        {/* Question Box */}
        <View style={[styles.questionCard, shadows.soft]}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
        </View>

        {/* Options List */}
        <View style={styles.optionsList}>
          {currentQuestion.options.map((option, optIdx) => {
            const isSelected = selectedOptionIndex === optIdx;
            const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

            return (
              <TouchableOpacity
                key={optIdx}
                activeOpacity={0.8}
                onPress={() => handleSelectOption(optIdx)}
                style={[
                  styles.optionCard,
                  shadows.soft,
                  isSelected && styles.optionCardSelected,
                ]}
              >
                <View
                  style={[
                    styles.optionLetterBox,
                    isSelected && styles.optionLetterBoxSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLetterText,
                      isSelected && styles.optionLetterTextSelected,
                    ]}
                  >
                    {letter}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                  ]}
                >
                  {option}
                </Text>

                <View
                  style={[
                    styles.radioCircle,
                    isSelected && styles.radioCircleSelected,
                  ]}
                >
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Action Footer */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom + 8, 16) },
        ]}
      >
        <View style={styles.bottomButtonsRow}>
          {currentIndex > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handlePrevious}
              style={styles.prevButton}
            >
              <Ionicons name="arrow-back" size={18} color="#475569" />
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }}>
            <Button
              title={isLastQuestion ? 'Submit Assessment' : 'Next Question →'}
              onPress={handleNext}
              disabled={selectedOptionIndex === undefined}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  progressBarSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressStepText: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  criteriaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  criteriaBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: '#7C3AED',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  categoryPillRow: {
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentPurpleLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 5,
  },
  categoryPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.md,
  },
  questionText: {
    fontSize: typography.sizes.base + 1,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    lineHeight: 26,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FAF9FF',
  },
  optionLetterBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  optionLetterBoxSelected: {
    backgroundColor: colors.primary,
  },
  optionLetterText: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#64748B',
  },
  optionLetterTextSelected: {
    color: '#FFFFFF',
  },
  optionText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    lineHeight: 20,
    marginRight: spacing.sm,
  },
  optionTextSelected: {
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  prevButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },

  // Results styling
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
  },
  resultCardPass: {
    borderColor: '#86EFAC',
  },
  resultCardFail: {
    borderColor: '#FDE68A',
  },
  resultIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  resultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  resultBadgeText: {
    fontSize: 11,
    fontWeight: typography.weights.heavy,
    letterSpacing: 0.5,
  },
  resultTitle: {
    fontSize: typography.sizes.xl + 2,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    marginBottom: spacing.xs,
  },
  scorePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    marginVertical: spacing.sm,
  },
  scoreText: {
    fontSize: typography.sizes.sm,
    color: '#475569',
    fontWeight: '600',
  },
  scoreNumber: {
    fontSize: typography.sizes.base,
    fontWeight: 'bold',
    color: colors.primary,
  },
  resultDescription: {
    fontSize: typography.sizes.sm,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  assignedRoleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.lg,
    gap: 8,
    marginTop: spacing.sm,
  },
  assignedRoleText: {
    fontSize: typography.sizes.xs + 1,
    color: colors.textPrimary,
  },
  actionButtonsContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  reviewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: 6,
  },
  reviewToggleText: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  reviewList: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  reviewHeaderTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    marginBottom: spacing.xs,
  },
  reviewItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reviewItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  reviewItemQuestionText: {
    flex: 1,
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
    color: '#1E293B',
  },
  reviewOptionsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginLeft: 28,
    gap: 4,
  },
  reviewYourAnswer: {
    fontSize: 11,
    color: '#475569',
  },
  reviewCorrectAnswer: {
    fontSize: 11,
    color: '#475569',
  },
  reviewExplanation: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 2,
  },
});
