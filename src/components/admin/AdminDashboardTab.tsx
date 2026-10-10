import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { AdminDashboard, ContentStat } from '../../api/admin.api';
import { BarChart, Row, Section, StatTile, TileGrid, compact } from './adminUi';

/** 'YYYY-MM-DD' → '28 Sep'. */
const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' });

const CONTENT_TYPES = [
  { key: 'videos', label: 'Videos', icon: 'videocam', color: '#4F46E5' },
  { key: 'reels', label: 'Reels', icon: 'play-circle', color: '#DB2777' },
  { key: 'audio', label: 'Audio', icon: 'musical-notes', color: '#D97706' },
  { key: 'photos', label: 'Photos', icon: 'image', color: '#16A34A' },
  { key: 'discussions', label: 'Discussions', icon: 'chatbubbles', color: '#0284C7' },
] as const;

type ContentKey = (typeof CONTENT_TYPES)[number]['key'];

export const AdminDashboardTab: React.FC<{ data: AdminDashboard }> = ({ data }) => {
  const [contentKey, setContentKey] = useState<ContentKey>('videos');
  const [usageMetric, setUsageMetric] = useState<'minutes' | 'activeUsers'>('minutes');

  const growthChart = data.users.growth.map((g) => ({ label: shortDay(g.day), value: g.signups }));
  const totalChart = data.users.growth.map((g) => ({ label: shortDay(g.day), value: g.total }));
  const usageChart = data.activity.timeSpent.map((t) => ({ label: shortDay(t.day), value: t[usageMetric] }));
  const selected = CONTENT_TYPES.find((c) => c.key === contentKey)!;
  const stat: ContentStat = data.content[contentKey];
  const postsChart = data.content.postsPerDay.map((p) => ({ label: shortDay(p.day), value: p[contentKey] }));
  const totalPosts = CONTENT_TYPES.reduce((s, c) => s + data.content[c.key].total, 0);

  return (
    <View style={styles.wrap}>
      <Text style={styles.updated}>
        Live data · updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </Text>

      {/* Users */}
      <Section title="Users" subtitle="Registered accounts and growth" icon="people">
        <TileGrid>
          <StatTile label="Total users" value={data.users.total} icon="people" hint={`+${data.users.newLast30Days} in 30 days`} />
          <StatTile label="New this week" value={data.users.newLast7Days} icon="person-add" color="#16A34A" />
          <StatTile label="Learners" value={data.users.learners} icon="school" color="#4F46E5" />
          <StatTile label="Mentors" value={data.users.mentors} icon="ribbon" color="#7C3AED" />
          <StatTile label="Guests" value={data.users.guests ?? 0} icon="person-outline" color="#64748B" />
        </TileGrid>
        <Text style={styles.chartTitle}>New sign-ups per day (last 30 days)</Text>
        <BarChart data={growthChart} color="#16A34A" />
        <Text style={styles.chartTitle}>Total users (cumulative)</Text>
        <BarChart data={totalChart} color="#4F46E5" height={80} />
        <Row label="Still onboarding (no role yet)" value={data.users.onboarding} />
        <Row label="Admins" value={data.users.admins} />
      </Section>

      {/* Engagement / time spent */}
      <Section title="Time spent in the app" subtitle="Measured from foreground app time" icon="time">
        <TileGrid>
          <StatTile label="Active today" value={data.activity.dailyActiveUsers} icon="pulse" hint="DAU" />
          <StatTile label="Active this week" value={data.activity.weeklyActiveUsers} icon="calendar" hint="WAU" />
          <StatTile label="Active this month" value={data.activity.monthlyActiveUsers} icon="stats-chart" hint="MAU" />
          <StatTile
            label="Avg. per active user"
            value={`${data.activity.avgMinutesPerActiveUser} min`}
            icon="hourglass"
            hint="per day, last 30 days"
            color="#D97706"
          />
        </TileGrid>
        <View style={styles.toggleRow}>
          {([
            { key: 'minutes', label: 'Total minutes' },
            { key: 'activeUsers', label: 'Active users' },
          ] as const).map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setUsageMetric(t.key)}
              style={[styles.toggle, usageMetric === t.key && styles.toggleActive]}
            >
              <Text style={[styles.toggleText, usageMetric === t.key && styles.toggleTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <BarChart data={usageChart} color="#D97706" unit={usageMetric === 'minutes' ? 'm' : ''} />
        <Row label="Minutes spent today (all users)" value={data.activity.minutesToday} />
        <Row label="Total hours, last 30 days" value={data.activity.totalHoursLast30Days} strong />
      </Section>

      {/* Content */}
      <Section title="Content" subtitle={`${compact(totalPosts)} posts in total`} icon="albums">
        <View style={styles.toggleRow}>
          {CONTENT_TYPES.map((c) => (
            <TouchableOpacity
              key={c.key}
              onPress={() => setContentKey(c.key)}
              style={[styles.toggle, contentKey === c.key && { backgroundColor: c.color }]}
            >
              <Text style={[styles.toggleText, contentKey === c.key && styles.toggleTextActive]}>
                {c.label} ({compact(data.content[c.key].total)})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TileGrid>
          <StatTile label={`Total ${selected.label.toLowerCase()}`} value={stat.total} icon={selected.icon} color={selected.color} hint={`+${stat.last7Days} this week`} />
          <StatTile label="Views" value={stat.views} icon="eye" color={selected.color} />
          <StatTile label="Likes" value={stat.likes} icon="heart" color={selected.color} />
          <StatTile label="Comments" value={stat.comments} icon="chatbubble" color={selected.color} />
        </TileGrid>
        <Text style={styles.chartTitle}>{selected.label} published per day</Text>
        <BarChart data={postsChart} color={selected.color} />
        <Row label="Private (circle-only / vault)" value={stat.private} />
        <Row label="Scheduled posts waiting to publish" value={data.content.scheduledPending} />
      </Section>

      {/* Circles */}
      <Section title="Circles" subtitle="Communities and membership" icon="people-circle">
        <TileGrid>
          <StatTile label="Circles" value={data.circles.total} icon="people-circle" hint={`${data.circles.userCreated} created by members`} />
          <StatTile label="Memberships" value={data.circles.memberships} icon="person-add" color="#7C3AED" />
          <StatTile label="Posts shared to circles" value={data.circles.postsInCircles} icon="share-social" color="#0284C7" />
          <StatTile label="Event completions" value={data.circles.eventCompletions} icon="trophy" color="#D97706" hint={`${data.circles.events} events`} />
        </TileGrid>
        <Text style={styles.chartTitle}>Largest circles</Text>
        {data.circles.top.length === 0 ? (
          <Text style={styles.muted}>No memberships yet.</Text>
        ) : (
          data.circles.top.map((c, i) => (
            <Row key={c.id} label={`${i + 1}. ${c.name}${c.category ? ` · ${c.category}` : ''}`} value={`${c.members} members`} />
          ))
        )}
      </Section>

      {/* Engagement */}
      <Section title="Engagement" subtitle="All-time interactions" icon="heart">
        <TileGrid>
          <StatTile label="Views" value={data.engagement.views} icon="eye" />
          <StatTile label="Likes" value={data.engagement.likes} icon="heart" color="#DC2626" />
          <StatTile label="Comments" value={data.engagement.comments} icon="chatbubble" color="#0284C7" />
          <StatTile label="Mentor critiques" value={data.engagement.critiques} icon="ribbon" color="#7C3AED" />
          <StatTile label="Reposts" value={data.engagement.reposts} icon="repeat" color="#16A34A" />
          <StatTile label="Follows" value={data.engagement.follows} icon="person-add" color="#D97706" />
        </TileGrid>
        <Row label="Saved to library" value={data.engagement.saves} />
      </Section>

      {/* XP economy */}
      <Section title={`XP economy · Season ${data.xp.seasonNumber}`} icon="flash">
        <TileGrid>
          <StatTile label="XP awarded this season" value={data.xp.seasonXpAwarded} icon="flash" color="#4F46E5" />
          <StatTile label="Members earning XP" value={data.xp.seasonParticipants} icon="people" color="#4F46E5" />
        </TileGrid>
        <Row label="Lifetime XP awarded" value={data.xp.lifetimeXpAwarded} />
        <Row label="Active XP rules" value={`${data.xp.activeRules} (${data.xp.customRules} custom)`} />
        <Row label="Active rewards" value={data.xp.activeRewards} />
        <Row label="Rewards claimed (all time)" value={data.xp.rewardClaims} />
      </Section>

      {/* Moderation */}
      <Section title="Moderation" icon="shield-checkmark">
        <Row label="Open reports" value={data.moderation.openReports} strong />
        <Row label="Resolved reports" value={data.moderation.reviewedReports} />
        <Row label="Hidden posts" value={data.moderation.hiddenPosts} />
      </Section>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  updated: { fontSize: 11, color: '#94A3B8', textAlign: 'center' },
  chartTitle: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 4 },
  muted: { fontSize: 12, color: '#94A3B8' },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F1F5F9' },
  toggleActive: { backgroundColor: '#D97706' },
  toggleText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  toggleTextActive: { color: '#FFFFFF' },
});
