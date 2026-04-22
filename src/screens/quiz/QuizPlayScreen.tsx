// ============================================================================
// Quiz Play Screen — core quiz experience
// ============================================================================

import React, { useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { submitAnswer, completeSession } from '../../api/sessions';
import { OptionCard } from '../../components/quiz/OptionCard';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme';
import type { QuizStackParamList } from '../../navigation/types';
import type { Question } from '../../api/questions';

type Nav = NativeStackNavigationProp<QuizStackParamList>;

export function QuizPlayScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();

  const { sessionId, questions, subjectName } = route.params as {
    sessionId: string;
    questions: Question[];
    subjectName: string;
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [openAnswer, setOpenAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ correct: 0, totalXp: 0 });
  const startTime = useRef(Date.now());
  const scrollRef = useRef<ScrollView>(null);

  const question = questions[currentIndex];
  const content = question?.content;
  const total = questions.length;
  const progress = ((currentIndex + 1) / total) * 100;
  const isLastQuestion = currentIndex === total - 1;

  const getResponse = () => {
    switch (question.type) {
      case 'CLOSED':
        return selectedAnswer;
      case 'TRUE_FALSE':
        return selectedAnswer; // simplified — single T/F
      case 'OPEN':
        return openAnswer;
      default:
        return selectedAnswer || openAnswer;
    }
  };

  const handleSubmit = async () => {
    const response = getResponse();
    if (!response) return Alert.alert('Wybierz odpowiedź');

    setLoading(true);
    try {
      const timeSpentMs = Date.now() - startTime.current;
      const res = await submitAnswer({
        questionId: question.id,
        sessionId,
        response,
        timeSpentMs,
      });
      setResult(res);
      setSubmitted(true);
      setStats((prev) => ({
        correct: prev.correct + (res.isCorrect ? 1 : 0),
        totalXp: prev.totalXp + (res.xpEarned || 0),
      }));
    } catch (err: any) {
      Alert.alert('Błąd', err.message || 'Nie udało się zapisać odpowiedzi');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (isLastQuestion) {
      // Complete session
      try {
        const sessionResult = await completeSession(sessionId);
        navigation.replace('QuizResult', {
          sessionId,
          questionsAnswered: sessionResult.questionsAnswered,
          correctAnswers: sessionResult.correctAnswers,
          accuracy: sessionResult.accuracy,
          xpEarned: sessionResult.totalXpEarned,
          totalTimeMs: sessionResult.totalTimeMs,
        });
      } catch {
        navigation.replace('QuizResult', {
          sessionId,
          questionsAnswered: total,
          correctAnswers: stats.correct,
          accuracy: total > 0 ? Math.round((stats.correct / total) * 100) : 0,
          xpEarned: stats.totalXp,
          totalTimeMs: 0,
        });
      }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setOpenAnswer('');
      setSubmitted(false);
      setResult(null);
      startTime.current = Date.now();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const handleQuit = () => {
    Alert.alert('Zakończyć?', 'Twój postęp zostanie zapisany.', [
      { text: 'Kontynuuj', style: 'cancel' },
      {
        text: 'Zakończ',
        style: 'destructive',
        onPress: () => navigation.goBack(),
      },
    ]);
  };

  if (!question) return null;

  // ── Determine option state ─────────────────────────────────────────────
  const getOptionState = (optId: string) => {
    if (!submitted) return optId === selectedAnswer ? 'selected' : 'default';
    if (content.correctAnswer === optId) return 'correct';
    if (optId === selectedAnswer && content.correctAnswer !== optId) return 'wrong';
    return 'default';
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: spacing[5],
          paddingBottom: 12,
          backgroundColor: theme.card,
          borderBottomWidth: 1,
          borderBottomColor: theme.borderLight,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <TouchableOpacity onPress={handleQuit}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: theme.text }}>
            {currentIndex + 1} / {total}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'DMSans_400Regular', color: theme.textSecondary }}>
            {subjectName}
          </Text>
        </View>
        <ProgressBar progress={progress} height={4} animated={false} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingTop: spacing[5],
          paddingBottom: insets.bottom + 120,
        }}
      >
        {/* Metadata */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: radius.full,
              backgroundColor: theme.primaryLight,
            }}
          >
            <Text style={{ fontSize: 11, fontFamily: 'Outfit_500Medium', color: theme.primaryText }}>
              {question.type.replace('_', ' ')}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: 3,
              alignItems: 'center',
            }}
          >
            {[1, 2, 3, 4, 5].map((d) => (
              <View
                key={d}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: d <= question.difficulty ? colors.brand[500] : theme.border,
                }}
              />
            ))}
          </View>
          {question.source && (
            <Text style={{ fontSize: 11, fontFamily: 'DMSans_400Regular', color: theme.textTertiary }}>
              {question.source}
            </Text>
          )}
        </View>

        {/* Question text */}
        <Text
          style={{
            fontSize: 17,
            fontFamily: 'DMSans_500Medium',
            color: theme.text,
            lineHeight: 26,
            marginBottom: 24,
          }}
        >
          {content.question || content.prompt}
        </Text>

        {/* ── CLOSED — ABCD options ──────────────────────────────────────── */}
        {question.type === 'CLOSED' && content.options && (
          <View style={{ gap: 10 }}>
            {content.options.map((opt: any) => (
              <OptionCard
                key={opt.id}
                id={opt.id}
                text={opt.text}
                state={getOptionState(opt.id) as any}
                onPress={() => !submitted && setSelectedAnswer(opt.id)}
                disabled={submitted}
              />
            ))}
          </View>
        )}

        {/* ── TRUE_FALSE ─────────────────────────────────────────────────── */}
        {question.type === 'TRUE_FALSE' && content.statements && (
          <View style={{ gap: 12 }}>
            {content.statements.map((stmt: any, i: number) => (
              <Card key={i} variant="stat">
                <Text style={{ fontSize: 14, fontFamily: 'DMSans_400Regular', color: theme.text, marginBottom: 10 }}>
                  {stmt.text}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['Prawda', 'Fałsz'].map((label) => {
                    const val = label === 'Prawda' ? 'true' : 'false';
                    const key = `${i}_${val}`;
                    return (
                      <TouchableOpacity
                        key={label}
                        onPress={() => !submitted && setSelectedAnswer(key)}
                        disabled={submitted}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: radius.xl,
                          borderWidth: 2,
                          borderColor: selectedAnswer === key ? colors.brand[500] : theme.border,
                          backgroundColor: selectedAnswer === key ? colors.brand[500] + '1A' : 'transparent',
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontFamily: 'Outfit_500Medium',
                            color: selectedAnswer === key ? colors.brand[600] : theme.textSecondary,
                          }}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* ── OPEN — text input ──────────────────────────────────────────── */}
        {(question.type === 'OPEN' || question.type === 'ESSAY') && (
          <TextInput
            value={openAnswer}
            onChangeText={setOpenAnswer}
            multiline
            numberOfLines={6}
            editable={!submitted}
            placeholder="Wpisz odpowiedź..."
            placeholderTextColor={theme.textTertiary}
            style={{
              backgroundColor: theme.inputBg,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: radius.xl,
              padding: spacing[4],
              fontSize: 15,
              fontFamily: 'DMSans_400Regular',
              color: theme.text,
              textAlignVertical: 'top',
              minHeight: 150,
            }}
          />
        )}

        {/* ── Fallback for unsupported types ─────────────────────────────── */}
        {!['CLOSED', 'TRUE_FALSE', 'OPEN', 'ESSAY'].includes(question.type) &&
          content.options && (
            <View style={{ gap: 10 }}>
              {content.options.map((opt: any) => (
                <OptionCard
                  key={opt.id}
                  id={opt.id}
                  text={opt.text}
                  state={getOptionState(opt.id) as any}
                  onPress={() => !submitted && setSelectedAnswer(opt.id)}
                  disabled={submitted}
                />
              ))}
            </View>
          )}

        {/* ── Result feedback ────────────────────────────────────────────── */}
        {submitted && result && (
          <Card
            style={{
              marginTop: 20,
              borderColor: result.isCorrect ? colors.brand[500] : colors.red[500],
              borderWidth: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons
                name={result.isCorrect ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={result.isCorrect ? colors.brand[500] : colors.red[500]}
              />
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Outfit_700Bold',
                  color: result.isCorrect ? colors.brand[600] : colors.red[600],
                }}
              >
                {result.isCorrect ? 'Brawo!' : 'Niestety, źle'}
              </Text>
              {result.xpEarned > 0 && (
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Outfit_600SemiBold',
                    color: colors.brand[500],
                    marginLeft: 'auto',
                  }}
                >
                  +{result.xpEarned} XP
                </Text>
              )}
            </View>
            {result.explanation && (
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'DMSans_400Regular',
                  color: theme.textSecondary,
                  lineHeight: 21,
                }}
              >
                {result.explanation}
              </Text>
            )}
          </Card>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: spacing[5],
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderTopColor: theme.borderLight,
        }}
      >
        {!submitted ? (
          <Button
            title="Sprawdź"
            onPress={handleSubmit}
            loading={loading}
            disabled={!selectedAnswer && !openAnswer}
            size="lg"
          />
        ) : (
          <Button
            title={isLastQuestion ? 'Zakończ quiz' : 'Następne pytanie'}
            onPress={handleNext}
            variant={isLastQuestion ? 'secondary' : 'primary'}
            size="lg"
            icon={
              <Ionicons
                name={isLastQuestion ? 'checkmark-done' : 'arrow-forward'}
                size={18}
                color="#fff"
              />
            }
          />
        )}
      </View>
    </View>
  );
}
