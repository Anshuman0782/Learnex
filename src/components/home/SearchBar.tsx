import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, ScrollView, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onFilterPress?: () => void;
  placeholder?: string;
  onSelectCategory?: (category: string) => void;
  activeCategory?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onFilterPress,
  placeholder = 'Search skills, mentors, clips...',
}) => {
  return (
    <View style={styles.container}>
      {/* Floating Search Pill */}
      <View style={[styles.searchWrapper, shadows.soft]}>
        <Ionicons
          name="search-outline"
          size={19}
          color="#6366F1"
          style={styles.searchIcon}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          style={styles.input}
        />
        {value.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onChangeText('')}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={17} color="#94A3B8" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onFilterPress}
          style={styles.filterButton}
        >
          <Ionicons name="options" size={16} color="#4F46E5" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: spacing.base,
    height: 46,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  filterButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  categoryScroll: {
    gap: 7,
    paddingRight: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 5,
  },
  categoryChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
