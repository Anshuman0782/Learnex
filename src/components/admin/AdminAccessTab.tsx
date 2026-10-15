import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import {
  getAdminsRequest,
  grantAdminRequest,
  revokeAdminRequest,
  searchAdminUsersRequest,
  type AdminAccount,
  type AdminUserResult, skillsLine } from '../../api/admin.api';
import { ADMIN_ACCENT, Badge, EmptyState, Field, Section, errorMessage, isForbidden } from './adminUi';

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const AdminAccessTab: React.FC<{ onForbidden: () => void }> = ({ onForbidden }) => {
  const { user, showDialog } = useApp();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleError = (e: unknown) => {
    if (isForbidden(e)) onForbidden();
    else Alert.alert('Admin access', errorMessage(e));
  };

  useEffect(() => {
    getAdminsRequest()
      .then(setAdmins)
      .catch(handleError)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced user search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let active = true;
    const t = setTimeout(() => {
      searchAdminUsersRequest(q)
        .then((r) => active && setResults(r))
        .catch((e) => active && handleError(e))
        .finally(() => active && setSearching(false));
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const grant = (u: AdminUserResult) => {
    showDialog({
      title: `Give ${u.name} Admin access?`,
      message: `${u.name} will be able to open the Admin Panel: view statistics, manage admins, XP rules and rewards. You can remove this at any time.`,
      icon: 'shield-checkmark-outline',
      confirmText: 'Grant access',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setBusyId(u.id);
        try {
          setAdmins(await grantAdminRequest(u.id));
          setResults((prev) => prev.map((r) => (r.id === u.id ? { ...r, isAdmin: true } : r)));
        } catch (e) {
          handleError(e);
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const revoke = (a: AdminAccount) => {
    showDialog({
      title: `Remove ${a.name}'s Admin access?`,
      message: `${a.name} will immediately lose access to the Admin Panel. You can grant it again later.`,
      icon: 'person-remove-outline',
      confirmText: 'Remove access',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        setBusyId(a.id);
        try {
          setAdmins(await revokeAdminRequest(a.id));
          setResults((prev) => prev.map((r) => (r.id === a.id ? { ...r, isAdmin: false } : r)));
        } catch (e) {
          handleError(e);
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  return (
    <View style={styles.wrap}>
      <Section
        title={`People with Admin access (${admins.length})`}
        subtitle="Owners always keep access. Any admin can add or remove other admins."
        icon="shield-checkmark"
      >
        {loading ? (
          <ActivityIndicator color={ADMIN_ACCENT} />
        ) : (
          admins.map((a) => {
            const isMe = a.id === user?.id;
            return (
              <View key={a.id} style={styles.personRow}>
                <Avatar uri={a.avatarUrl} name={a.name} size={40} />
                <View style={styles.personInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{a.name}</Text>
                    {a.isOwner && <Badge text="Owner" icon="key" color="#B45309" bg="#FEF3C7" />}
                    {isMe && <Badge text="You" color="#0F766E" bg="#CCFBF1" />}
                  </View>
                  <Text style={styles.email} numberOfLines={1}>{a.email}</Text>
                  {!!skillsLine(a) && <Text style={styles.meta} numberOfLines={2}>{skillsLine(a)}</Text>}
                  <Text style={styles.meta}>
                    {a.isOwner ? 'Owner account' : `Added ${formatDate(a.grantedAt)}${a.grantedByName ? ` by ${a.grantedByName}` : ''}`}
                  </Text>
                </View>
                {!a.isOwner && !isMe && (
                  <TouchableOpacity
                    disabled={busyId === a.id}
                    onPress={() => revoke(a)}
                    style={styles.revokeBtn}
                  >
                    {busyId === a.id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Text style={styles.revokeText}>Remove</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </Section>

      <Section title="Add an admin" subtitle="Search any member by name or email" icon="person-add">
        <Field
          label="Search members"
          value={query}
          onChangeText={setQuery}
          placeholder="Name or email (min. 2 characters)"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching ? (
          <ActivityIndicator color={ADMIN_ACCENT} />
        ) : query.trim().length >= 2 && results.length === 0 ? (
          <EmptyState icon="search-outline" title="No members found" />
        ) : (
          results.map((u) => (
            <View key={u.id} style={styles.personRow}>
              <Avatar uri={u.avatarUrl} name={u.name} size={36} />
              <View style={styles.personInfo}>
                <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
                <Text style={styles.email} numberOfLines={1}>
                  {u.email}
                </Text>
                <Text style={styles.meta} numberOfLines={2}>
                  {skillsLine(u) || 'No role yet'}
                </Text>
              </View>
              {u.isAdmin ? (
                <Badge text="Admin" icon="shield-checkmark" color="#0F766E" bg="#CCFBF1" />
              ) : (
                <TouchableOpacity
                  disabled={busyId === u.id}
                  onPress={() => grant(u)}
                  style={styles.grantBtn}
                >
                  {busyId === u.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="add" size={14} color="#FFFFFF" />
                      <Text style={styles.grantText}>Make admin</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </Section>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  personInfo: { flex: 1, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  email: { fontSize: 11, color: '#64748B' },
  meta: { fontSize: 10, color: '#94A3B8' },
  revokeBtn: {
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 76,
    alignItems: 'center',
  },
  revokeText: { fontSize: 12, fontWeight: '800', color: '#DC2626' },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: ADMIN_ACCENT,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    minWidth: 104,
    justifyContent: 'center',
  },
  grantText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
});
