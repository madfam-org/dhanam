import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ComponentProps, useCallback, useState } from 'react';

import { ErrorState } from '@/components/ErrorState';
import { LoadingScreen } from '@/components/LoadingScreen';
import {
  Ionicons,
  router,
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  PaperText as Text,
  Card,
  Button,
  Chip,
  Divider,
  IconButton,
  TouchableRipple,
} from '@/lib/react-native-compat';
import { apiClient } from '@/services/api';
import {
  NotificationPayload,
  NotificationType,
  getNotificationIcon,
  getNotificationColor,
  getNotificationDeepLink,
  clearAllNotifications,
} from '@/services/notifications';

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const {
    data: notifications,
    isLoading,
    refetch,
    error,
  } = useQuery<NotificationPayload[]>({
    queryKey: ['notifications', filter],
    queryFn: async () => {
      const params = filter === 'unread' ? '?unread=true' : '';
      const response = await apiClient.get(`/notifications${params}`);
      return response.data;
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      clearAllNotifications();
    },
  });

  const handleNotificationPress = useCallback(
    (notification: NotificationPayload) => {
      // Mark as read
      if (!notification.read) {
        markAsReadMutation.mutate(notification.id);
      }

      // Navigate to deep link
      const deepLink =
        notification.deepLink || getNotificationDeepLink(notification.type, notification.data);
      if (deepLink) {
        router.push(deepLink as never);
      }
    },
    [markAsReadMutation]
  );

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeLabel = (type: NotificationType) => {
    const labels: Record<NotificationType, string> = {
      budget_alert: 'Budget',
      budget_exceeded: 'Budget',
      transaction_new: 'Transaction',
      transaction_large: 'Transaction',
      account_sync: 'Account',
      account_error: 'Account',
      goal_milestone: 'Goal',
      goal_achieved: 'Goal',
      security_alert: 'Security',
      system_update: 'System',
      recurring_reminder: 'Recurring',
      esg_update: 'ESG',
    };
    return labels[type] || 'Notification';
  };

  if (isLoading) {
    return <LoadingScreen message="Loading notifications..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Notifications"
        message="Unable to fetch your notifications."
        action={refetch}
        actionLabel="Retry"
      />
    );
  }

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;
  const filteredNotifications =
    filter === 'unread' ? notifications?.filter((n) => !n.read) : notifications;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text variant="headlineSmall" style={styles.title}>
                Notifications
              </Text>
              {unreadCount > 0 && (
                <Text variant="bodyMedium" style={styles.unreadCount}>
                  {unreadCount} unread
                </Text>
              )}
            </View>
            {unreadCount > 0 && (
              <Button
                mode="text"
                onPress={() => markAllReadMutation.mutate()}
                loading={markAllReadMutation.isPending}
                compact
              >
                Mark all read
              </Button>
            )}
          </View>

          {/* Filter Chips */}
          <View style={styles.filterRow}>
            <Chip
              selected={filter === 'all'}
              onPress={() => setFilter('all')}
              mode={filter === 'all' ? 'flat' : 'outlined'}
              style={filter === 'all' ? styles.filterChipActive : styles.filterChip}
              textStyle={filter === 'all' ? styles.filterChipTextActive : undefined}
            >
              All
            </Chip>
            <Chip
              selected={filter === 'unread'}
              onPress={() => setFilter('unread')}
              mode={filter === 'unread' ? 'flat' : 'outlined'}
              style={filter === 'unread' ? styles.filterChipActive : styles.filterChip}
              textStyle={filter === 'unread' ? styles.filterChipTextActive : undefined}
            >
              Unread ({unreadCount})
            </Chip>
          </View>
        </View>

        {/* Notifications List */}
        {filteredNotifications && filteredNotifications.length > 0 ? (
          <View style={styles.notificationsList}>
            {filteredNotifications.map((notification, index) => (
              <View key={notification.id}>
                <TouchableRipple
                  onPress={() => handleNotificationPress(notification)}
                  style={[styles.notificationItem, !notification.read && styles.notificationUnread]}
                  accessibilityRole="button"
                  accessibilityLabel={`${notification.title}. ${notification.body}`}
                >
                  <View style={styles.notificationContent}>
                    {/* Icon */}
                    <View
                      style={[
                        styles.notificationIcon,
                        {
                          backgroundColor: `${getNotificationColor(notification.type)}15`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          getNotificationIcon(notification.type) as ComponentProps<
                            typeof Ionicons
                          >['name']
                        }
                        size={22}
                        color={getNotificationColor(notification.type)}
                      />
                    </View>

                    {/* Content */}
                    <View style={styles.notificationText}>
                      <View style={styles.notificationTitleRow}>
                        <Text
                          variant="titleSmall"
                          style={[
                            styles.notificationTitle,
                            !notification.read && styles.notificationTitleUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {notification.title}
                        </Text>
                        {!notification.read && <View style={styles.unreadDot} />}
                      </View>
                      <Text variant="bodyMedium" style={styles.notificationBody} numberOfLines={2}>
                        {notification.body}
                      </Text>
                      <View style={styles.notificationMeta}>
                        <Chip
                          mode="outlined"
                          textStyle={styles.typeChipText}
                          style={[
                            styles.typeChip,
                            {
                              borderColor: getNotificationColor(notification.type),
                            },
                          ]}
                        >
                          {getTypeLabel(notification.type)}
                        </Chip>
                        <Text variant="bodySmall" style={styles.timeText}>
                          {getRelativeTime(notification.createdAt)}
                        </Text>
                      </View>
                    </View>

                    {/* Chevron */}
                    <Ionicons name="chevron-forward" size={18} color="#BDBDBD" />
                  </View>
                </TouchableRipple>
                {index < filteredNotifications.length - 1 && <Divider style={styles.divider} />}
              </View>
            ))}
          </View>
        ) : (
          /* Empty State */
          <View style={styles.emptyState}>
            <Ionicons
              name="notifications-off-outline"
              size={80}
              color="#E0E0E0"
              style={styles.emptyIcon}
            />
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              {filter === 'unread' ? 'All Caught Up' : 'No Notifications Yet'}
            </Text>
            <Text variant="bodyLarge" style={styles.emptyMessage}>
              {filter === 'unread'
                ? 'You have no unread notifications'
                : 'Notifications about your budgets, transactions, and goals will appear here'}
            </Text>
            {filter === 'unread' && (
              <Button mode="outlined" onPress={() => setFilter('all')} style={styles.viewAllButton}>
                View All Notifications
              </Button>
            )}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontWeight: '700',
    color: '#212121',
  },
  unreadCount: {
    color: '#6366f1',
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#FAFAFA',
  },
  filterChipActive: {
    backgroundColor: '#6366f1',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  notificationsList: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  notificationItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  notificationUnread: {
    backgroundColor: '#F5F3FF',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  notificationTitle: {
    color: '#212121',
    flex: 1,
  },
  notificationTitleUnread: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
  notificationBody: {
    color: '#757575',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeChip: {
    backgroundColor: 'transparent',
    height: 24,
  },
  typeChipText: {
    fontSize: 10,
    lineHeight: 12,
  },
  timeText: {
    color: '#9E9E9E',
  },
  divider: {
    backgroundColor: '#F0F0F0',
    marginLeft: 72,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 24,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#212121',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#757575',
    marginBottom: 24,
    lineHeight: 24,
  },
  viewAllButton: {
    paddingHorizontal: 16,
  },
  bottomPadding: {
    height: 40,
  },
});
