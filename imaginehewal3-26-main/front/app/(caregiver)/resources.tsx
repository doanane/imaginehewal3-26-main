// front/app/(caregiver)/resources.tsx
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Dimensions,
    Image,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GRADIENTS, theme } from '../../constants/theme';

const { width } = Dimensions.get('window');

interface Resource {
  id: number;
  title: string;
  description: string;
  category: string;
  type: 'article' | 'video' | 'guide' | 'tool';
  duration?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  thumbnail: string;
  views: number;
  rating: number;
}

export default function ResourcesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All', icon: 'apps', color: theme.COLORS.primary },
    { id: 'training', label: 'Training', icon: 'school', color: theme.COLORS.info },
    { id: 'protocols', label: 'Protocols', icon: 'document-text', color: theme.COLORS.success },
    { id: 'tools', label: 'Tools', icon: 'construct', color: theme.COLORS.warning },
    { id: 'guides', label: 'Guides', icon: 'book', color: theme.COLORS.medicalTeal },
  ];

  const resources: Resource[] = [
    {
      id: 1,
      title: 'Patient Care Best Practices',
      description: 'Comprehensive guide on modern patient care standards and techniques',
      category: 'training',
      type: 'guide',
      duration: '30 min read',
      difficulty: 'beginner',
      thumbnail: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400',
      views: 1245,
      rating: 4.8
    },
    {
      id: 2,
      title: 'Medication Administration Protocol',
      description: 'Step-by-step protocol for safe medication administration',
      category: 'protocols',
      type: 'article',
      duration: '15 min read',
      difficulty: 'intermediate',
      thumbnail: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
      views: 892,
      rating: 4.9
    },
    {
      id: 3,
      title: 'Emergency Response Training',
      description: 'Video series on handling medical emergencies',
      category: 'training',
      type: 'video',
      duration: '45 min',
      difficulty: 'advanced',
      thumbnail: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=400',
      views: 2156,
      rating: 4.7
    },
    {
      id: 4,
      title: 'Vital Signs Tracker',
      description: 'Interactive tool for recording and analyzing patient vitals',
      category: 'tools',
      type: 'tool',
      duration: 'Interactive',
      difficulty: 'beginner',
      thumbnail: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400',
      views: 3421,
      rating: 4.6
    },
  ];

  const filteredResources = resources.filter(resource => {
    const matchesCategory = selectedCategory === 'all' || resource.category === selectedCategory;
    const matchesSearch = resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'article': return 'document-text';
      case 'video': return 'videocam';
      case 'guide': return 'book';
      case 'tool': return 'construct';
      default: return 'document';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return theme.COLORS.success;
      case 'intermediate': return theme.COLORS.warning;
      case 'advanced': return theme.COLORS.danger;
      default: return theme.COLORS.textSecondary;
    }
  };

  const renderResourceCard = (resource: Resource, index: number) => (
    <Animated.View
      key={resource.id}
      entering={FadeInDown.delay(index * 50)}
      style={styles.resourceCard}
    >
      <TouchableOpacity activeOpacity={0.8}>
        <Image source={{ uri: resource.thumbnail }} style={styles.thumbnail} />
        <View style={styles.typeBadge}>
          <Ionicons name={getTypeIcon(resource.type) as any} size={12} color="#FFFFFF" />
          <Text style={styles.typeBadgeText}>{resource.type.toUpperCase()}</Text>
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.resourceTitle} numberOfLines={2}>{resource.title}</Text>
          <Text style={styles.resourceDescription} numberOfLines={2}>{resource.description}</Text>
          
          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={theme.COLORS.textTertiary} />
              <Text style={styles.metaText}>{resource.duration}</Text>
            </View>
            <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(resource.difficulty) + '15' }]}>
              <Text style={[styles.difficultyText, { color: getDifficultyColor(resource.difficulty) }]}>
                {resource.difficulty}
              </Text>
            </View>
          </View>
          
          <View style={styles.cardFooter}>
            <View style={styles.footerItem}>
              <Ionicons name="eye-outline" size={14} color={theme.COLORS.textTertiary} />
              <Text style={styles.footerText}>{resource.views.toLocaleString()}</Text>
            </View>
            <View style={styles.footerItem}>
              <Ionicons name="star" size={14} color={theme.COLORS.warning} />
              <Text style={styles.footerText}>{resource.rating}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Resources</Text>
            <Text style={styles.headerSubtitle}>Learn & Grow</Text>
          </View>
          <TouchableOpacity style={styles.bookmarkButton}>
            <Ionicons name="bookmark-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.COLORS.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search resources..."
            placeholderTextColor={theme.COLORS.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </LinearGradient>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && styles.categoryChipActive
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Ionicons 
              name={cat.icon as any} 
              size={16} 
              color={selectedCategory === cat.id ? '#FFFFFF' : cat.color} 
            />
            <Text style={[
              styles.categoryChipText,
              { color: selectedCategory === cat.id ? '#FFFFFF' : cat.color }
            ]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Resources Grid */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.resourcesContainer}>
        <Text style={styles.sectionTitle}>
          {selectedCategory === 'all' ? 'All Resources' : categories.find(c => c.id === selectedCategory)?.label}
          <Text style={styles.countText}> ({filteredResources.length})</Text>
        </Text>
        
        <View style={styles.resourcesGrid}>
          {filteredResources.map((resource, index) => renderResourceCard(resource, index))}
        </View>

        {filteredResources.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color={theme.COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No Resources Found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search or filters</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 40,
    paddingHorizontal: theme.SPACING.lg,
    paddingBottom: theme.SPACING.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  bookmarkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.LAYOUT.borderRadius.lg,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.SPACING.sm,
    fontSize: 16,
    color: '#FFFFFF',
  },
  categoriesContainer: {
    maxHeight: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.border,
  },
  categoriesContent: {
    paddingHorizontal: theme.SPACING.lg,
    paddingVertical: theme.SPACING.md,
    gap: theme.SPACING.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.xs,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
    borderRadius: 20,
    backgroundColor: theme.COLORS.background,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: theme.COLORS.primary,
    borderColor: theme.COLORS.primary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  resourcesContainer: {
    padding: theme.SPACING.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.lg,
  },
  countText: {
    fontSize: 16,
    fontWeight: '400',
    color: theme.COLORS.textSecondary,
  },
  resourcesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.SPACING.md,
  },
  resourceCard: {
    width: (width - theme.SPACING.lg * 2 - theme.SPACING.md) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.LAYOUT.borderRadius.lg,
    overflow: 'hidden',
    ...theme.SHADOWS.medium,
  },
  thumbnail: {
    width: '100%',
    height: 120,
    backgroundColor: theme.COLORS.background,
  },
  typeBadge: {
    position: 'absolute',
    top: theme.SPACING.sm,
    right: theme.SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: theme.LAYOUT.borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardContent: {
    padding: theme.SPACING.md,
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.xs,
    lineHeight: 20,
  },
  resourceDescription: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: theme.SPACING.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.sm,
    paddingBottom: theme.SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: theme.COLORS.textTertiary,
  },
  difficultyBadge: {
    paddingHorizontal: theme.SPACING.xs,
    paddingVertical: 2,
    borderRadius: theme.LAYOUT.borderRadius.sm,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 11,
    color: theme.COLORS.textTertiary,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.SPACING.xxl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
    marginTop: theme.SPACING.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    marginTop: theme.SPACING.xs,
  },
});
