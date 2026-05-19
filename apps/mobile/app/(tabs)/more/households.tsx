import React, { useState, useCallback } from 'react';
import { ScrollView, RefreshControl, Alert } from 'react-native';

import {
  useHouseholds,
  useHousehold,
  useHouseholdNetWorth,
  useHouseholdGoalSummary,
  useCreateHousehold,
  useDeleteHousehold,
  Household,
  CreateHouseholdInput,
  HOUSEHOLD_TYPES,
  HouseholdType,
} from '@/hooks/api/useHouseholds';
import { useSpaces } from '@/hooks/useSpaces';
import {
  Ionicons,
  View,
  StyleSheet,
  PaperText as Text,
  Card,
  Button,
  TextInput,
  ActivityIndicator,
  Divider,
  FAB,
  Portal,
  Dialog,
  Menu,
  IconButton,
  Chip,
} from '@/lib/react-native-compat';

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  family: { bg: '#E3F2FD', text: '#2196F3' },
  trust: { bg: '#F3E5F5', text: '#9C27B0' },
  estate: { bg: '#FFF3E0', text: '#FF9800' },
  partnership: { bg: '#E8F5E9', text: '#4CAF50' },
};

export default function HouseholdsScreen() {
  const { currentSpace } = useSpaces();
  const currency = currentSpace?.currency || 'USD';

  const [refreshing, setRefreshing] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);

  // Form state
  const [householdName, setHouseholdName] = useState('');
  const [householdType, setHouseholdType] = useState<HouseholdType>('family');
  const [householdDescription, setHouseholdDescription] = useState('');

  const { data: households, isLoading, refetch } = useHouseholds();
  const { data: selectedHousehold } = useHousehold(selectedHouseholdId);
  const { data: netWorth } = useHouseholdNetWorth(selectedHouseholdId);
  const { data: goalSummary } = useHouseholdGoalSummary(selectedHouseholdId);
  const createMutation = useCreateHousehold();
  const deleteMutation = useDeleteHousehold();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const resetForm = () => {
    setHouseholdName('');
    setHouseholdType('family');
    setHouseholdDescription('');
  };

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }

    const input: CreateHouseholdInput = {
      name: householdName.trim(),
      type: householdType,
      baseCurrency: currency,
      description: householdDescription.trim() || undefined,
    };

    try {
      await createMutation.mutateAsync(input);
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to create household');
    }
  };

  const handleDeleteHousehold = (household: Household) => {
    Alert.alert(
      'Delete Household',
      `Are you sure you want to delete "${household.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(household.id);
              if (selectedHouseholdId === household.id) {
                setSelectedHouseholdId(null);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete household');
            }
          },
        },
      ]
    );
  };

  const handleHouseholdPress = (household: Household) => {
    setSelectedHouseholdId(household.id);
  };

  const selectedTypeInfo = HOUSEHOLD_TYPES.find((t) => t.value === householdType);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading households...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header Info */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoHeader}>
              <Ionicons name="people" size={28} color="#4CAF50" />
              <Text variant="titleMedium" style={styles.infoTitle}>
                Multi-Generational Planning
              </Text>
            </View>
            <Text variant="bodySmall" style={styles.infoText}>
              Manage family finances with Yours, Mine & Ours ownership views
            </Text>
          </Card.Content>
        </Card>

        {/* Households List */}
        {!households || households.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyCardContent}>
              <Ionicons name="people-outline" size={48} color="#BDBDBD" />
              <Text variant="titleMedium" style={styles.emptyCardTitle}>
                No Households Yet
              </Text>
              <Text variant="bodyMedium" style={styles.emptyCardDescription}>
                Create your first household to start multi-generational planning
              </Text>
              <Button
                mode="contained"
                buttonColor="#4CAF50"
                onPress={() => setShowCreateDialog(true)}
                style={styles.emptyCardButton}
              >
                Create Household
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.householdsCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Your Households
              </Text>
              {households.map((household, index) => {
                const typeInfo = HOUSEHOLD_TYPES.find((t) => t.value === household.type);
                const colors = TYPE_COLORS[household.type] || TYPE_COLORS.family;
                const isSelected = selectedHouseholdId === household.id;

                return (
                  <React.Fragment key={household.id}>
                    <View style={[styles.householdRow, isSelected && styles.householdRowSelected]}>
                      <Button
                        mode="text"
                        onPress={() => handleHouseholdPress(household)}
                        contentStyle={styles.householdButtonContent}
                        style={styles.householdButton}
                      >
                        <View style={styles.householdContent}>
                          <View style={[styles.householdIcon, { backgroundColor: colors.bg }]}>
                            <Ionicons
                              name={(typeInfo?.icon || 'people-outline') as any}
                              size={24}
                              color={colors.text}
                            />
                          </View>
                          <View style={styles.householdInfo}>
                            <Text variant="titleSmall" style={styles.householdName}>
                              {household.name}
                            </Text>
                            <View style={styles.householdMeta}>
                              <Chip
                                compact
                                style={[styles.typeChip, { backgroundColor: colors.bg }]}
                              >
                                <Text style={[styles.typeChipText, { color: colors.text }]}>
                                  {typeInfo?.label || 'Family'}
                                </Text>
                              </Chip>
                              <Text variant="bodySmall" style={styles.memberCount}>
                                {household._count?.spaces || 0} spaces
                              </Text>
                            </View>
                          </View>
                          <IconButton
                            icon="trash-outline"
                            size={18}
                            iconColor="#F44336"
                            onPress={() => handleDeleteHousehold(household)}
                          />
                        </View>
                      </Button>
                    </View>
                    {index < households.length - 1 && <Divider style={styles.divider} />}
                  </React.Fragment>
                );
              })}
            </Card.Content>
          </Card>
        )}

        {/* Selected Household Details */}
        {selectedHousehold && (
          <>
            <Text variant="titleLarge" style={styles.detailsTitle}>
              {selectedHousehold.name} Details
            </Text>

            {/* Net Worth Card */}
            {netWorth && (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <Ionicons name="wallet" size={24} color="#4CAF50" />
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      Total Net Worth
                    </Text>
                  </View>
                  <Text variant="displaySmall" style={styles.netWorthValue}>
                    {formatCurrency(netWorth.totalNetWorth, selectedHousehold.baseCurrency)}
                  </Text>
                  {netWorth.bySpace.length > 0 && (
                    <View style={styles.spaceBreakdown}>
                      {netWorth.bySpace.map((space) => (
                        <View key={space.spaceId} style={styles.spaceRow}>
                          <Text variant="bodyMedium" style={styles.spaceName}>
                            {space.spaceName}
                          </Text>
                          <Text variant="bodyMedium" style={styles.spaceValue}>
                            {formatCurrency(space.netWorth, selectedHousehold.baseCurrency)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Card.Content>
              </Card>
            )}

            {/* Goals Summary Card */}
            {goalSummary && (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <Ionicons name="flag" size={24} color="#2196F3" />
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      Goals Summary
                    </Text>
                  </View>
                  <View style={styles.goalsGrid}>
                    <View style={styles.goalStat}>
                      <Text variant="headlineMedium" style={styles.goalStatValue}>
                        {goalSummary.totalGoals}
                      </Text>
                      <Text variant="bodySmall" style={styles.goalStatLabel}>
                        Total Goals
                      </Text>
                    </View>
                    <View style={styles.goalStat}>
                      <Text
                        variant="headlineMedium"
                        style={[styles.goalStatValue, { color: '#4CAF50' }]}
                      >
                        {goalSummary.activeGoals}
                      </Text>
                      <Text variant="bodySmall" style={styles.goalStatLabel}>
                        Active
                      </Text>
                    </View>
                    <View style={styles.goalStat}>
                      <Text
                        variant="headlineMedium"
                        style={[styles.goalStatValue, { color: '#2196F3' }]}
                      >
                        {goalSummary.achievedGoals}
                      </Text>
                      <Text variant="bodySmall" style={styles.goalStatLabel}>
                        Achieved
                      </Text>
                    </View>
                  </View>
                  <Divider style={styles.goalsDivider} />
                  <View style={styles.targetRow}>
                    <Text variant="bodyMedium" style={styles.targetLabel}>
                      Total Target Amount
                    </Text>
                    <Text variant="titleMedium" style={styles.targetValue}>
                      {formatCurrency(
                        goalSummary.totalTargetAmount,
                        selectedHousehold.baseCurrency
                      )}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            )}

            {/* Members Card */}
            {selectedHousehold.members && selectedHousehold.members.length > 0 && (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <Ionicons name="people" size={24} color="#9C27B0" />
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      Members ({selectedHousehold.members.length})
                    </Text>
                  </View>
                  {selectedHousehold.members.map((member, index) => (
                    <React.Fragment key={member.id}>
                      <View style={styles.memberRow}>
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberInitial}>
                            {member.user?.name?.charAt(0) || '?'}
                          </Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text variant="bodyLarge" style={styles.memberName}>
                            {member.user?.name || 'Unknown'}
                          </Text>
                          <Text variant="bodySmall" style={styles.memberRelationship}>
                            {member.relationship}
                          </Text>
                        </View>
                        {member.isMinor && (
                          <Chip compact style={styles.minorChip}>
                            Minor
                          </Chip>
                        )}
                      </View>
                      {index < selectedHousehold.members!.length - 1 && (
                        <Divider style={styles.memberDivider} />
                      )}
                    </React.Fragment>
                  ))}
                </Card.Content>
              </Card>
            )}
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* FAB */}
      {households && households.length > 0 && (
        <FAB
          icon="add"
          style={styles.fab}
          onPress={() => setShowCreateDialog(true)}
          color="#FFFFFF"
        />
      )}

      {/* Create Household Dialog */}
      <Portal>
        <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)}>
          <Dialog.Title>Create Household</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Household Name"
              value={householdName}
              onChangeText={setHouseholdName}
              mode="outlined"
              placeholder="Smith Family"
              style={styles.dialogInput}
            />
            <Menu
              visible={typeMenuVisible}
              onDismiss={() => setTypeMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setTypeMenuVisible(true)}
                  style={styles.typeButton}
                >
                  <View style={styles.typeButtonInner}>
                    <Ionicons
                      name={(selectedTypeInfo?.icon || 'home-outline') as any}
                      size={20}
                      color="#424242"
                    />
                    <Text style={styles.typeButtonText}>
                      {selectedTypeInfo?.label || 'Select Type'}
                    </Text>
                  </View>
                </Button>
              }
            >
              {HOUSEHOLD_TYPES.map((type) => (
                <Menu.Item
                  key={type.value}
                  onPress={() => {
                    setHouseholdType(type.value);
                    setTypeMenuVisible(false);
                  }}
                  title={type.label}
                  leadingIcon={type.icon as any}
                />
              ))}
            </Menu>
            <TextInput
              label="Description (optional)"
              value={householdDescription}
              onChangeText={setHouseholdDescription}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onPress={handleCreateHousehold} loading={createMutation.isPending}>
              Create
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#757575',
  },
  scrollView: {
    flex: 1,
  },
  infoCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
    backgroundColor: '#E8F5E9',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  infoTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  infoText: {
    color: '#757575',
  },
  emptyCard: {
    margin: 16,
    marginTop: 8,
    elevation: 1,
  },
  emptyCardContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyCardTitle: {
    fontWeight: '600',
    color: '#212121',
    marginTop: 16,
  },
  emptyCardDescription: {
    color: '#757575',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 16,
  },
  emptyCardButton: {
    marginTop: 24,
  },
  householdsCard: {
    margin: 16,
    marginTop: 8,
    elevation: 1,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  householdRow: {
    borderRadius: 8,
  },
  householdRowSelected: {
    backgroundColor: '#E8F5E9',
  },
  householdButton: {
    flex: 1,
  },
  householdButtonContent: {
    justifyContent: 'flex-start',
  },
  householdContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  householdIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  householdInfo: {
    flex: 1,
    marginLeft: 12,
  },
  householdName: {
    fontWeight: '600',
    color: '#212121',
  },
  householdMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  typeChip: {
    height: 22,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  memberCount: {
    color: '#757575',
  },
  divider: {
    marginVertical: 4,
  },
  detailsTitle: {
    fontWeight: '600',
    color: '#212121',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  card: {
    margin: 16,
    marginTop: 8,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  netWorthValue: {
    fontWeight: '700',
    color: '#2E7D32',
  },
  spaceBreakdown: {
    marginTop: 16,
    gap: 8,
  },
  spaceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spaceName: {
    color: '#424242',
  },
  spaceValue: {
    fontWeight: '600',
    color: '#212121',
  },
  goalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  goalStat: {
    alignItems: 'center',
  },
  goalStatValue: {
    fontWeight: '700',
    color: '#212121',
  },
  goalStatLabel: {
    color: '#757575',
    marginTop: 4,
  },
  goalsDivider: {
    marginVertical: 16,
  },
  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetLabel: {
    color: '#424242',
  },
  targetValue: {
    fontWeight: '600',
    color: '#2196F3',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2196F3',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontWeight: '600',
    color: '#212121',
  },
  memberRelationship: {
    color: '#757575',
    textTransform: 'capitalize',
  },
  minorChip: {
    backgroundColor: '#FFF3E0',
  },
  memberDivider: {
    marginVertical: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#4CAF50',
  },
  dialogInput: {
    marginTop: 12,
  },
  typeButton: {
    marginTop: 12,
    marginBottom: 4,
  },
  typeButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeButtonText: {
    color: '#424242',
  },
  bottomPadding: {
    height: 80,
  },
});
