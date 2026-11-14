import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import api from '../../services/api';

export default function LeaderboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<any>(null);

  const loadLeaderboard = async () => {
    try {
      const response = await api.getWeeklyLeaderboard();
      setLeaderboardData(response || []);
      setUserRank(null);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaderboard();
  };

  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <MaterialCommunityIcons name="medal" size={24} color="#FFD700" />;
      case 2:
        return <MaterialCommunityIcons name="medal" size={24} color="#C0C0C0" />;
      case 3:
        return <MaterialCommunityIcons name="medal" size={24} color="#CD7F32" />;
      default:
        return <Text style={styles.rankNumber}>{rank}</Text>;
    }
  };

  const renderLeaderboardItem = ({ item, index }: { item: any; index: number }) => (
    <View style={[styles.leaderboardItem, index === 0 && styles.topRankItem]}>
      <View style={styles.rankContainer}>
        {getMedalIcon(index + 1)}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.user_name || 'Anonymous'}</Text>
        <Text style={styles.userScore}>{item.score || 0} points</Text>
      </View>
      <View style={styles.scoreDisplay}>
        <Text style={styles.scoreValue}>{item.score || 0}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={styles.placeholder} />
      </View>

      {userRank && (
        <View style={styles.userRankCard}>
          <Text style={styles.userRankLabel}>Your Rank</Text>
          <View style={styles.userRankContent}>
            <Text style={styles.userRankPosition}>#{userRank.rank}</Text>
            <View style={styles.userRankDivider} />
            <Text style={styles.userRankScore}>{userRank.score} pts</Text>
          </View>
        </View>
      )}

      <FlatList
        data={leaderboardData}
        renderItem={renderLeaderboardItem}
        keyExtractor={(item, index) => item.user_id || index.toString()}
        scrollEnabled={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No leaderboard data available</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  placeholder: {
    width: 24,
  },
  userRankCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  userRankLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  userRankContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userRankPosition: {
    fontSize: 28,
    fontWeight: '700',
    color: '#007bff',
  },
  userRankDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
  userRankScore: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f59e0b',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  topRankItem: {
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#007bff',
  },
  rankContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  userScore: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  scoreDisplay: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  scoreValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
});