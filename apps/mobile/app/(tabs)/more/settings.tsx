import React, { useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import {
  Ionicons,
  View,
  ScrollView,
  StyleSheet,
  PaperText as Text,
  Card,
  List,
  Divider,
  Switch,
  Button,
  Dialog,
  Portal,
  TextInput,
} from '@/lib/react-native-compat';

interface SettingsSection {
  id: string;
  title: string;
  items: SettingsItem[];
}

interface SettingsItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  type: 'navigation' | 'toggle' | 'action' | 'info';
  value?: boolean;
  infoValue?: string;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

export default function SettingsScreen() {
  const { user, updateProfile } = useAuth();

  // Settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [transactionNotifications, setTransactionNotifications] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Dialog state
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');

  const settingsSections: SettingsSection[] = [
    {
      id: 'account',
      title: 'Account',
      items: [
        {
          id: 'name',
          title: 'Name',
          icon: 'person-outline',
          type: 'navigation',
          infoValue: user?.name,
          onPress: () => {
            setEditedName(user?.name || '');
            setShowNameDialog(true);
          },
        },
        {
          id: 'email',
          title: 'Email',
          icon: 'mail-outline',
          type: 'info',
          infoValue: user?.email,
        },
        {
          id: 'language',
          title: 'Language',
          icon: 'language-outline',
          type: 'navigation',
          infoValue: user?.locale === 'es' ? 'Spanish' : 'English',
          onPress: () => {
            // Navigate to language selection
          },
        },
        {
          id: 'timezone',
          title: 'Timezone',
          icon: 'time-outline',
          type: 'info',
          infoValue: user?.timezone || 'America/Mexico_City',
        },
      ],
    },
    {
      id: 'security',
      title: 'Security',
      items: [
        {
          id: 'biometric',
          title: 'Face ID / Touch ID',
          description: 'Use biometrics to unlock app',
          icon: 'finger-print-outline',
          type: 'toggle',
          value: biometricEnabled,
          onToggle: setBiometricEnabled,
        },
        {
          id: 'change-password',
          title: 'Change Password',
          icon: 'key-outline',
          type: 'navigation',
          onPress: () => {
            // Navigate to change password
          },
        },
        {
          id: 'two-factor',
          title: 'Two-Factor Authentication',
          description: user?.totpEnabled ? 'Enabled' : 'Not set up',
          icon: 'shield-checkmark-outline',
          type: 'navigation',
          onPress: () => {
            // Navigate to 2FA setup
          },
        },
      ],
    },
    {
      id: 'notifications',
      title: 'Notifications',
      items: [
        {
          id: 'push-notifications',
          title: 'Push Notifications',
          description: 'Receive push notifications',
          icon: 'notifications-outline',
          type: 'toggle',
          value: notificationsEnabled,
          onToggle: setNotificationsEnabled,
        },
        {
          id: 'budget-alerts',
          title: 'Budget Alerts',
          description: 'Get alerted when approaching budget limits',
          icon: 'alert-circle-outline',
          type: 'toggle',
          value: budgetAlerts,
          onToggle: setBudgetAlerts,
        },
        {
          id: 'transaction-notifications',
          title: 'Transaction Notifications',
          description: 'Notify on new transactions',
          icon: 'cash-outline',
          type: 'toggle',
          value: transactionNotifications,
          onToggle: setTransactionNotifications,
        },
      ],
    },
    {
      id: 'appearance',
      title: 'Appearance',
      items: [
        {
          id: 'dark-mode',
          title: 'Dark Mode',
          description: 'Use dark theme',
          icon: 'moon-outline',
          type: 'toggle',
          value: darkMode,
          onToggle: setDarkMode,
        },
      ],
    },
    {
      id: 'data',
      title: 'Data & Privacy',
      items: [
        {
          id: 'export-data',
          title: 'Export Data',
          description: 'Download your financial data',
          icon: 'download-outline',
          type: 'navigation',
          onPress: () => {
            // Export data
          },
        },
        {
          id: 'privacy-policy',
          title: 'Privacy Policy',
          icon: 'document-text-outline',
          type: 'navigation',
          onPress: () => {
            // Open privacy policy
          },
        },
        {
          id: 'delete-account',
          title: 'Delete Account',
          description: 'Permanently delete your account',
          icon: 'trash-outline',
          type: 'action',
          onPress: () => {
            // Show delete account confirmation
          },
        },
      ],
    },
  ];

  const renderSettingsItem = (item: SettingsItem) => {
    const rightElement = () => {
      switch (item.type) {
        case 'toggle':
          return <Switch value={item.value} onValueChange={item.onToggle} />;
        case 'navigation':
          return (
            <View style={styles.navigationRight}>
              {item.infoValue && (
                <Text variant="bodyMedium" style={styles.infoValue}>
                  {item.infoValue}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={20} color="#757575" />
            </View>
          );
        case 'info':
          return (
            <Text variant="bodyMedium" style={styles.infoValue}>
              {item.infoValue}
            </Text>
          );
        case 'action':
          return <Ionicons name="chevron-forward" size={20} color="#757575" />;
        default:
          return null;
      }
    };

    const isDestructive = item.id === 'delete-account';

    return (
      <List.Item
        key={item.id}
        title={item.title}
        titleStyle={isDestructive ? styles.destructiveTitle : undefined}
        description={item.description}
        left={() => (
          <View style={[styles.iconContainer, isDestructive && styles.destructiveIconContainer]}>
            <Ionicons name={item.icon} size={22} color={isDestructive ? '#F44336' : '#4CAF50'} />
          </View>
        )}
        right={rightElement}
        onPress={item.type !== 'info' ? item.onPress : undefined}
        style={styles.listItem}
      />
    );
  };

  const handleSaveName = async () => {
    if (!editedName.trim() || editedName === user?.name) {
      setShowNameDialog(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({ name: editedName.trim() });
      setShowNameDialog(false);
    } catch (error) {
      console.error('Failed to update name:', error);
      // Could show an error toast here
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {settingsSections.map((section) => (
          <Card key={section.id} style={styles.sectionCard}>
            <Card.Content style={styles.sectionContent}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                {section.title}
              </Text>
              {section.items.map((item, index) => (
                <React.Fragment key={item.id}>
                  {renderSettingsItem(item)}
                  {index < section.items.length - 1 && <Divider style={styles.divider} />}
                </React.Fragment>
              ))}
            </Card.Content>
          </Card>
        ))}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Edit Name Dialog */}
      <Portal>
        <Dialog visible={showNameDialog} onDismiss={() => setShowNameDialog(false)}>
          <Dialog.Title>Edit Name</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={editedName}
              onChangeText={setEditedName}
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowNameDialog(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onPress={handleSaveName} loading={isSaving} disabled={isSaving}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 16,
    elevation: 1,
  },
  sectionContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#757575',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listItem: {
    paddingVertical: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  destructiveIconContainer: {
    backgroundColor: '#FFEBEE',
  },
  destructiveTitle: {
    color: '#F44336',
  },
  navigationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValue: {
    color: '#757575',
  },
  divider: {
    marginLeft: 64,
  },
  bottomPadding: {
    height: 40,
  },
});
