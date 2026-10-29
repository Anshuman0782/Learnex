import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAiProgressRequest, type AiProgressResponse, type AiSkillProgress } from '../../api/ai.api';
import { getSocket } from '../../realtime/socket';

const TREND = {
  up: { icon: 'trending-up' as const, color: '#16A34A', bg: '#DCFCE7', word: 'Improving' },
  down: { icon: 'trending-down' as const, color: '#DC2626', bg: '#FEE2E2', word: 'Dropping' },
  steady: { icon: 'remove' as const, color: '#475569', bg: '#F1F5F9', word: 'Steady' },
};

/**
 * AI Progress (only you see this): for each AI-judged skill, whether you're
 * improving — recent posts vs earlier ones — plus your strongest / weakest
 * area and the latest feedback. Updates live when a new review lands.
 */
export const AiProgressCard: React.FC = () => {
  const [data, setData] = useState<AiProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getAiProgressRequest());
    } catch {
      /* keep what we have */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const sock = getSocket();
    const onReview = () => void load();
    sock?.on('ai:review', onReview);
    return () => {
      sock?.off('ai:review', onReview);
    };
  }, [load]);

  if (loading && !data) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#4F46E5" />
      </View>
    );
  }
  // Nothing to show: no AI-judged skills and no reviews.
  if (!data || (data.skills.length === 0 && data.eligible.length === 0)) return null;

  const waitingSkills = data.eligible.filter((e) => !data.skills.some((s) => s.skill === e.skill));

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.headIcon}>
          <Ionicons name="sparkles" size={16} color="#7C3AED" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>AI Progress</Text>
          <Text style={styles.sub}>Only you can see this</Text>
        </View>
        {data.reviewing > 0 && (
          <View style={styles.reviewing}>
            <ActivityIndicator size="small" color="#4F46E5" />
            <Text style={styles.reviewingText}>Reviewing {data.reviewing}</Text>
          </View>
        )}
      </View>

      {data.skills.map((s) => (
        <SkillBlock key={s.skill} s={s} min={data.minPosts} expanded={open === s.skill} onToggle={() => setOpen(open === s.skill ? null : s.skill)} />
      ))}

      {waitingSkills.map((e) => (
        <View key={e.skill} style={styles.empty}>
          <Ionicons name="cloud-upload-outline" size={18} color="#94A3B8" />
          <Text style={styles.emptyText}>
            Post your {e.skillLabel} practice{e.skill === 'coding' ? ' (code + explanation)' : ' (audio or video)'} — after {data.minPosts} posts you’ll see your progress here.
          </Text>
        </View>
      ))}
    </View>
  );
};

const SkillBlock: React.FC<{ s: AiSkillProgress; min: number; expanded: boolean; onToggle: () => void }> = ({ s, min, expanded, onToggle }) => {
  const t = s.trend ? TREND[s.trend] : null;
  const max = Math.max(100, ...s.history.map((h) => h.score));
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onToggle} style={styles.block}>
      <View style={styles.blockHead}>
        <Text style={styles.skill}>{s.skillLabel}</Text>
        {s.status === 'ready' && t ? (
          <View style={[styles.trend, { backgroundColor: t.bg }]}>
            <Ionicons name={t.icon} size={14} color={t.color} />
            <Text style={[styles.trendText, { color: t.color }]}>
              {t.word}
              {s.changePct !== null && s.changePct !== 0 ? ` ${s.changePct > 0 ? '+' : ''}${s.changePct}%` : ''}
            </Text>
          </View>
        ) : (
          <Text style={styles.collecting}>{s.reviewedPosts}/{min} posts reviewed</Text>
        )}
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
      </View>

      {s.currentScore !== null && (
        <Text style={styles.scoreLine}>
          Score <Text style={styles.scoreBig}>{s.currentScore}</Text>/100
          {s.earlierScore !== null ? <Text style={styles.scoreWas}>  (was {s.earlierScore})</Text> : null}
        </Text>
      )}

      {/* Mini chart: score of each reviewed post, oldest → newest */}
      <View style={styles.chart}>
        {s.history.map((h) => (
          <View key={h.postId} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                { height: `${Math.max(6, (h.score / max) * 100)}%` },
                h.partial && styles.barPartial,
                h.mentorRated && styles.barMentor,
              ]}
            />
          </View>
        ))}
      </View>

      {s.status === 'collecting' && (
        <Text style={styles.hint}>
          {s.neededPosts > 0 ? `${s.neededPosts} more reviewed post${s.neededPosts === 1 ? '' : 's'} to see your trend.` : 'Collecting enough reliable reviews for a trend.'}
        </Text>
      )}

      {(s.strongest || s.weakest) && (
        <View style={styles.sw}>
          {!!s.strongest && <Pill icon="star" color="#16A34A" text={`Strongest: ${s.strongest}`} />}
          {!!s.weakest && s.weakest !== s.strongest && <Pill icon="construct" color="#D97706" text={`Work on: ${s.weakest}`} />}
        </View>
      )}

      {expanded && (
        <View style={styles.details}>
          {s.criteria.map((c) => (
            <View key={c.key} style={styles.critRow}>
              <Text style={styles.critLabel}>{c.label}</Text>
              <View style={styles.critTrack}>
                <View style={[styles.critFill, { width: `${c.score ?? 0}%` }]} />
              </View>
              <Text style={styles.critScore}>{c.score ?? '—'}</Text>
            </View>
          ))}
          <Text style={styles.latestTitle}>Latest feedback{s.latest.title ? ` · ${s.latest.title}` : ''}</Text>
          {!!s.latest.summary && <Text style={styles.latestText}>{s.latest.summary}</Text>}
          {s.latest.improvements.map((x, i) => (
            <View key={i} style={styles.tip}>
              <Ionicons name="arrow-forward-circle" size={14} color="#4F46E5" />
              <Text style={styles.tipText}>{x}</Text>
            </View>
          ))}
          {s.latest.partial && <Text style={styles.hint}>This one was measured by our pitch analyser only (the AI judge was unavailable).</Text>}
          <Text style={styles.foot}>Scores come from an AI judge plus our own measurements, blended with real mentors’ ratings.</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const Pill: React.FC<{ icon: keyof typeof Ionicons.glyphMap; color: string; text: string }> = ({ icon, color, text }) => (
  <View style={styles.pill}>
    <Ionicons name={icon} size={12} color={color} />
    <Text style={styles.pillText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EEF2F7', padding: 14, marginTop: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  headIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 11, color: '#94A3B8' },
  reviewing: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  reviewingText: { fontSize: 11, fontWeight: '700', color: '#4338CA' },
  block: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10, marginTop: 8 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skill: { flex: 1, fontSize: 15, fontWeight: '800', color: '#0F172A' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  trendText: { fontSize: 12, fontWeight: '800' },
  collecting: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  scoreLine: { fontSize: 12, color: '#64748B', marginTop: 4 },
  scoreBig: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  scoreWas: { fontSize: 12, color: '#94A3B8' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 44, gap: 4, marginTop: 8 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', maxWidth: 22 },
  bar: { backgroundColor: '#818CF8', borderRadius: 4 },
  barPartial: { backgroundColor: '#CBD5E1' },
  barMentor: { backgroundColor: '#7C3AED' },
  hint: { fontSize: 11, color: '#94A3B8', marginTop: 6 },
  sw: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  details: { marginTop: 10, gap: 6 },
  critRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  critLabel: { width: 110, fontSize: 12, color: '#475569' },
  critTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EEF2FF', overflow: 'hidden' },
  critFill: { height: 6, borderRadius: 3, backgroundColor: '#4F46E5' },
  critScore: { width: 28, textAlign: 'right', fontSize: 12, fontWeight: '800', color: '#0F172A' },
  latestTitle: { fontSize: 12, fontWeight: '800', color: '#0F172A', marginTop: 8 },
  latestText: { fontSize: 13, color: '#334155', lineHeight: 19 },
  tip: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 12, color: '#334155', lineHeight: 17 },
  foot: { fontSize: 10, color: '#94A3B8', marginTop: 6 },
  empty: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10, marginTop: 8 },
  emptyText: { flex: 1, fontSize: 12, color: '#64748B', lineHeight: 17 },
});
