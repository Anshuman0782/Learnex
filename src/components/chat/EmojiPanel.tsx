import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

const CATEGORIES: { key: string; icon: IconName; emojis: string }[] = [
  {
    key: 'smileys',
    icon: 'happy-outline',
    emojis:
      '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👻 💀 🤖 👽 🎃',
  },
  {
    key: 'gestures',
    icon: 'hand-left-outline',
    emojis:
      '👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🫡 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💪 🦾 🧠 👀 👁️ 👄 🫦 🙋 🙆 🙅 🤷 🤦 🙇 💁 🧑‍💻 🧑‍🎤 🧑‍🎨 🧑‍🏫 🧑‍🎓 💃 🕺',
  },
  {
    key: 'hearts',
    icon: 'heart-outline',
    emojis:
      '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💯 ✨ ⭐ 🌟 💫 🔥 💥 🎉 🎊 🏆 🥇 🥈 🥉 🎖️ 🏅',
  },
  {
    key: 'activities',
    icon: 'musical-notes-outline',
    emojis:
      '🎵 🎶 🎤 🎧 🎸 🎹 🥁 🎷 🎺 🎻 🪕 🎬 🎨 🖌️ 📷 📸 🎥 📹 🎮 🕹️ 🎯 🎲 ♟️ ⚽ 🏀 🏈 ⚾ 🎾 🏐 🏓 🏸 🥊 🏋️ 🧘 🚴 🏃 🏊 🧗 ⛹️ 🤸',
  },
  {
    key: 'objects',
    icon: 'bulb-outline',
    emojis:
      '💡 📚 📖 📝 ✏️ 🖊️ 📌 📎 📅 🗓️ ⏰ ⌛ 💻 🖥️ ⌨️ 🖱️ 📱 ☎️ 🔋 🔌 💾 📁 📊 📈 📉 🧪 🔬 🔭 🧮 💼 🎁 🎈 🛒 💰 💳 🔑 🔒 🔔 📣 🚀 ✈️ 🚗 🏠 🌍',
  },
  {
    key: 'nature',
    icon: 'leaf-outline',
    emojis:
      '☀️ 🌤️ ⛅ 🌧️ ⛈️ 🌈 ❄️ ☃️ 🌙 ⭐ 🌊 🌸 🌺 🌻 🌹 🌷 🌱 🌿 🍀 🍁 🍂 🌳 🌴 🌵 🐶 🐱 🐭 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦋 🐝 🐢 🐬 🐳',
  },
  {
    key: 'food',
    icon: 'pizza-outline',
    emojis:
      '☕ 🍵 🧃 🥤 🍺 🍷 🍕 🍔 🍟 🌭 🥪 🌮 🌯 🍜 🍝 🍛 🍣 🍱 🥟 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 🍦 🍎 🍌 🍉 🍇 🍓 🥭 🍍 🥑 🥕 🌽',
  },
  {
    key: 'symbols',
    icon: 'checkmark-circle-outline',
    emojis: '✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ❓ ❗ ‼️ ⁉️ ⚠️ 🚫 ⛔ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🆗 🆕 🆒 🔝 🔜 ▶️ ⏸️ ⏹️ 🔁 🔀 🔊 🔇 💬 💭 🗯️ 👋',
  },
];

// Recently used emojis, kept for the app session (newest first).
let recentEmojis: string[] = [];

const split = (s: string) => s.split(' ').filter(Boolean);

interface Props {
  onPick: (emoji: string) => void;
  onBackspace: () => void;
  height?: number;
}

/** WhatsApp-style emoji keyboard: category tabs, a grid, recents and backspace. */
export const EmojiPanel: React.FC<Props> = ({ onPick, onBackspace, height = 280 }) => {
  const { width } = useWindowDimensions();
  const [cat, setCat] = useState(recentEmojis.length > 0 ? 'recent' : 'smileys');
  const [, force] = useState(0);
  const columns = Math.max(7, Math.floor(width / 46));

  const data = useMemo(
    () => (cat === 'recent' ? recentEmojis : split(CATEGORIES.find((c) => c.key === cat)?.emojis ?? '')),
    [cat],
  );

  const pick = (e: string) => {
    recentEmojis = [e, ...recentEmojis.filter((x) => x !== e)].slice(0, 32);
    onPick(e);
    if (cat === 'recent') force((n) => n + 1);
  };

  const tabs: { key: string; icon: IconName }[] = [
    { key: 'recent', icon: 'time-outline' },
    ...CATEGORIES.map((c) => ({ key: c.key, icon: c.icon })),
  ];

  return (
    <View style={[styles.wrap, { height }]}>
      <View style={styles.tabs}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.key} onPress={() => setCat(t.key)} style={[styles.tab, cat === t.key && styles.tabActive]}>
            <Ionicons name={t.icon} size={18} color={cat === t.key ? '#4F46E5' : '#94A3B8'} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={onBackspace} style={styles.tab} accessibilityLabel="Delete">
          <Ionicons name="backspace-outline" size={20} color="#64748B" />
        </TouchableOpacity>
      </View>
      {data.length === 0 ? (
        <Text style={styles.empty}>Emojis you use will show up here.</Text>
      ) : (
        <FlatList
          key={`${cat}-${columns}`}
          data={data}
          numColumns={columns}
          keyExtractor={(e, i) => `${e}-${i}`}
          keyboardShouldPersistTaps="always"
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => pick(item)} style={[styles.cell, { width: width / columns }]}>
              <Text style={styles.emoji}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  tabs: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tab: { paddingVertical: 9, paddingHorizontal: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#4F46E5' },
  cell: { height: 46, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 40, fontSize: 13 },
});
