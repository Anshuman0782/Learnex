import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { Header, Button } from '../../components/common';
import {
  getMentorQuizRequest,
  submitMentorQuizRequest,
  type QuizQuestion,
  type QuizResultResponse,
} from '../../api/onboarding.api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'MentorQuiz'>;

export const MentorQuizScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { enrollAsLearner, applyMentorSession, showDialog } = useApp();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [passMark, setPassMark] = useState(4);
  const [loadingQuiz, setLoadingQuiz] = useState(true);
  const [quizError, setQuizError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResultResponse | null>(null);
  const [entering, setEntering] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const currentQuestion = questions[currentIndex];
  const selectedOptionIndex = selectedAnswers[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  // Fetch a fresh quiz (no answer key) from the backend.
  const loadQuiz = useCallback(async () => {
    setLoadingQuiz(true);
    setQuizError(null);
    try {
      const data = await getMentorQuizRequest();
      setQuestions(data.questions);
      setPassMark(data.passMark);
      setCurrentIndex(0);
      setSelectedAnswers({});
      setResult(null);
      setShowReview(false);
    } catch (err: any) {
      setQuizError(
        err?.message || 'Could not load the assessment. Check your connection and try again.'
      );
    } finally {
      setLoadingQuiz(false);
    }
  }, []);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  const handleSelectOption = (optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const answers = questions.map((q, idx) => ({
        questionId: q.id,
        selectedIndex: selectedAnswers[idx],
      }));
      const res = await submitMentorQuizRequest(answers);
      // On a pass the backend granted Mentor + returned a fresh session.
      if (res.passed && res.session) {
        await applyMentorSession(res.session);
      }
      setResult(res);
    } catch (err: any) {
      showDialog({
        title: 'Submission Failed',
        message:
          err?.message || 'We couldn’t grade your assessment. Please try again.',
        icon: 'alert-circle-outline',
        confirmText: 'Try Again',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (selectedOptionIndex === undefined) {
      showDialog({
        title: 'Select an Answer',
        message: 'Please choose an option before proceeding.',
        icon: 'help-circle-outline',
        confirmText: 'Got it',
      });
      return;
    }
    if (!isLastQuestion) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const enterApp = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main', params: { screen: 'HomeTab' } }],
    });
  };

  // Fail path: the learner can still join directly.
  const handleContinueAsLearner = async () => {
    setEntering(true);
    try {
      await enrollAsLearner();
      enterApp();
    } catch (err: any) {
      showDialog({
        title: 'Something went wrong',
        message: err?.message || 'Please check your connection and try again.',
        icon: 'alert-circle-outline',
        confirmText: 'Try Again',
      });
    } finally {
      setEntering(false);
    }
  };

  const questionById = (id: string) => questions.find((q) => q.id === id);
  const progressPercent = questions.length
    ? ((currentIndex + 1) / questions.length) * 100
    : 0;

  // =================== LOADING / ERROR ===================
  if (loadingQuiz || quizError) {
    return (
      <View style={styles.container}>
        <View style={{ paddingTop: Math.max(insets.top, 10), backgroundColor: '#FFFFFF' }}>
          <Header title="Mentor Qualification" onBack={() => navigation.goBack()} />
        </View>
        <View style={styles.centerFill}>
          {loadingQuiz ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.centerText}>Preparing your assessment…</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-offline-outline" size={44} color="#94A3B8" />
              <Text style={styles.centerText}>{quizError}</Text>
              <Button title="Retry" onPress={loadQuiz} size="md" style={{ marginTop: spacing.md }} />
            </>
          )}
        </View>
      </View>
    );
  }

  // =================== RESULT VIEW ===================
  if (result) {
    const hasPassed = result.passed;
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
                {hasPassed ? 'QUALIFIED AS MENTOR 🎉' : 'NOT QUITE THERE YET 💡'}
              </Text>
            </View>

            <Text style={styles.resultTitle}>
              {hasPassed ? 'Mentor Certified!' : 'Almost there!'}
            </Text>

            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>
                Score: <Text style={styles.scoreNumber}>{result.score}</Text> / {result.total} Correct
              </Text>
            </View>

            <Text style={styles.resultDescription}>
              {hasPassed
                ? `Outstanding! You met the ${result.passMark}/${result.total} qualification criteria and unlocked full Mentor privileges including video critiques and community guidance.`
                : `You scored under ${result.passMark}/${result.total} required for Mentor qualification. You can retake the test, or join as a Learner to practice, receive mentor feedback, and level up.`}
            </Text>

            {hasPassed && (
              <View style={styles.assignedRoleChip}>
                <Ionicons name="ribbon" size={18} color="#7C3AED" />
                <Text style={styles.assignedRoleText}>
                  Active Role: <Text style={{ fontWeight: 'bold' }}>Mentor</Text>
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            {hasPassed ? (
              <Button title="Enter App as Mentor 🚀" onPress={enterApp} fullWidth size="lg" />
            ) : (
              <>
                <Button
                  title="Continue as Learner 🎓"
                  onPress={handleContinueAsLearner}
                  loading={entering}
                  fullWidth
                  size="lg"
                />
                <Button
                  title="Retake 5-Question Test 🔄"
                  onPress={loadQuiz}
                  variant="outline"
                  fullWidth
                  size="md"
                  style={{ marginTop: spacing.sm }}
                />
              </>
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

          {/* Review breakdown accordion — uses server-graded results */}
          {showReview && (
            <View style={styles.reviewList}>
              <Text style={styles.reviewHeaderTitle}>Assessment Review</Text>
              {result.results.map((r, qIndex) => {
                const q = questionById(r.questionId);
                if (!q) return null;
                return (
                  <View key={r.questionId} style={styles.reviewItemCard}>
                    <View style={styles.reviewItemHeader}>
                      <View
                        style={[
                          styles.statusIndicator,
                          { backgroundColor: r.isCorrect ? '#DCFCE7' : '#FEE2E2' },
                        ]}
                      >
                        <Ionicons
                          name={r.isCorrect ? 'checkmark' : 'close'}
                          size={14}
                          color={r.isCorrect ? '#166534' : '#DC2626'}
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
                            color: r.isCorrect ? '#166534' : '#DC2626',
                            fontWeight: '600',
                          }}
                        >
                          {r.selectedIndex !== undefined
                            ? q.options[r.selectedIndex]
                            : 'Not answered'}
                        </Text>
                      </Text>
                      {!r.isCorrect && (
                        <Text style={styles.reviewCorrectAnswer}>
                          Correct:{' '}
                          <Text style={{ color: '#166534', fontWeight: '600' }}>
                            {q.options[r.correctIndex]}
                          </Text>
                        </Text>
                      )}
                      <Text style={styles.reviewExplanation}>💡 {r.explanation}</Text>
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
      <View style={{ paddingTop: Math.max(insets.top, 10), backgroundColor: '#FFFFFF' }}>
        <Header title="Mentor Qualification" onBack={() => navigation.goBack()} />
      </View>

      <View style={styles.progressBarSection}>
        <View style={styles.progressTextRow}>
          <Text style={styles.progressStepText}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
          <View style={styles.criteriaBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#7C3AED" />
            <Text style={styles.criteriaBadgeText}>
              Pass: {passMark}/{questions.length} Correct
            </Text>
          </View>
        </View>

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
        <View style={styles.categoryPillRow}>
          <View style={styles.categoryPill}>
            <Ionicons name="sparkles" size={12} color={colors.primary} />
            <Text style={styles.categoryPillText}>
              {currentQuestion.category} • Mentorship MVP Test
            </Text>
          </View>
        </View>

        <View style={[styles.questionCard, shadows.soft]}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
        </View>

        <View style={styles.optionsList}>
          {currentQuestion.options.map((option, optIdx) => {
            const isSelected = selectedOptionIndex === optIdx;
            const letter = String.fromCharCode(65 + optIdx);

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

                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {option}
                </Text>

                <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
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
              loading={submitting}
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
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  centerText: {
    fontSize: typography.sizes.sm,
    color: '#64748B',
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
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
