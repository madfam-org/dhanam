import React, { useState, useCallback, useEffect } from 'react';
import { ScrollView, RefreshControl, Alert } from 'react-native';

import { useHouseholds, Household } from '@/hooks/api/useHouseholds';
import {
  useWillsByHousehold,
  useWill,
  useValidateWill,
  useCreateWill,
  useActivateWill,
  useRevokeWill,
  Will,
  CreateWillInput,
} from '@/hooks/api/useEstatePlanning';
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
  Chip,
  Checkbox,
} from '@/lib/react-native-compat';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#FFF3E0', text: '#FF9800' },
  active: { bg: '#E8F5E9', text: '#4CAF50' },
  revoked: { bg: '#FFEBEE', text: '#F44336' },
  executed: { bg: '#E3F2FD', text: '#2196F3' },
};

const STATUS_ICONS: Record<string, string> = {
  draft: 'time-outline',
  active: 'checkmark-circle-outline',
  revoked: 'close-circle-outline',
  executed: 'document-text-outline',
};

export default function EstatePlanningScreen() {
  const { currentSpace } = useSpaces();

  const [refreshing, setRefreshing] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [selectedWillId, setSelectedWillId] = useState<string | null>(null);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);

  // Form state
  const [willName, setWillName] = useState('');
  const [willNotes, setWillNotes] = useState('');

  const {
    data: households,
    isLoading: householdsLoading,
    refetch: refetchHouseholds,
  } = useHouseholds();
  const {
    data: wills,
    isLoading: willsLoading,
    refetch: refetchWills,
  } = useWillsByHousehold(selectedHouseholdId);
  const { data: selectedWill } = useWill(selectedWillId);
  const { data: validationResult } = useValidateWill(selectedWillId);
  const createMutation = useCreateWill();
  const activateMutation = useActivateWill();
  const revokeMutation = useRevokeWill();

  // Auto-select first household
  useEffect(() => {
    if (households && households.length > 0 && !selectedHouseholdId) {
      setSelectedHouseholdId(households[0].id);
    }
  }, [households, selectedHouseholdId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchHouseholds(), refetchWills()]);
    setRefreshing(false);
  }, [refetchHouseholds, refetchWills]);

  const resetForm = () => {
    setWillName('');
    setWillNotes('');
    setAcceptedDisclaimer(false);
  };

  const handleCreateWill = async () => {
    if (!selectedHouseholdId) {
      Alert.alert('Error', 'Please select a household first');
      return;
    }
    if (!willName.trim()) {
      Alert.alert('Error', 'Please enter a will name');
      return;
    }
    if (!acceptedDisclaimer) {
      Alert.alert('Error', 'Please accept the legal disclaimer');
      return;
    }

    const input: CreateWillInput = {
      householdId: selectedHouseholdId,
      name: willName.trim(),
      notes: willNotes.trim() || undefined,
      legalDisclaimer: acceptedDisclaimer,
    };

    try {
      await createMutation.mutateAsync(input);
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to create will');
    }
  };

  const handleActivateWill = async (willId: string) => {
    Alert.alert(
      'Activate Will',
      'Are you sure you want to activate this will? This makes it legally binding.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            try {
              await activateMutation.mutateAsync(willId);
              setSelectedWillId(null);
            } catch (error) {
              Alert.alert('Error', 'Failed to activate will');
            }
          },
        },
      ]
    );
  };

  const handleRevokeWill = async (willId: string) => {
    Alert.alert(
      'Revoke Will',
      'Are you sure you want to revoke this will? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeMutation.mutateAsync(willId);
              setSelectedWillId(null);
            } catch (error) {
              Alert.alert('Error', 'Failed to revoke will');
            }
          },
        },
      ]
    );
  };

  const isLoading = householdsLoading || willsLoading;

  if (isLoading && !households) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading estate planning...
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
        {/* Info Card */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoHeader}>
              <Ionicons name="document-text" size={28} color="#9C27B0" />
              <Text variant="titleMedium" style={styles.infoTitle}>
                Estate Planning
              </Text>
            </View>
            <Text variant="bodySmall" style={styles.infoText}>
              Manage wills, beneficiaries, and inheritance planning for your household
            </Text>
          </Card.Content>
        </Card>

        {/* Household Selector */}
        {households && households.length > 0 && (
          <View style={styles.householdSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {households.map((household) => (
                <Chip
                  key={household.id}
                  selected={selectedHouseholdId === household.id}
                  onPress={() => setSelectedHouseholdId(household.id)}
                  style={styles.householdChip}
                >
                  {household.name}
                </Chip>
              ))}
            </ScrollView>
          </View>
        )}

        {/* No Household State */}
        {(!households || households.length === 0) && (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyCardContent}>
              <Ionicons name="people-outline" size={48} color="#BDBDBD" />
              <Text variant="titleMedium" style={styles.emptyCardTitle}>
                No Households
              </Text>
              <Text variant="bodyMedium" style={styles.emptyCardDescription}>
                Create a household first to start estate planning
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Wills List */}
        {selectedHouseholdId && (!wills || wills.length === 0) && !willsLoading && (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyCardContent}>
              <Ionicons name="document-outline" size={48} color="#BDBDBD" />
              <Text variant="titleMedium" style={styles.emptyCardTitle}>
                No Wills Yet
              </Text>
              <Text variant="bodyMedium" style={styles.emptyCardDescription}>
                Create your first will to start estate planning
              </Text>
              <Button
                mode="contained"
                buttonColor="#9C27B0"
                onPress={() => setShowCreateDialog(true)}
                style={styles.emptyCardButton}
              >
                Create Will
              </Button>
            </Card.Content>
          </Card>
        )}

        {wills && wills.length > 0 && (
          <Card style={styles.willsCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Your Wills
              </Text>
              {wills.map((will, index) => {
                const colors = STATUS_COLORS[will.status] || STATUS_COLORS.draft;
                const icon = STATUS_ICONS[will.status] || 'document-outline';

                return (
                  <React.Fragment key={will.id}>
                    <Button
                      mode="text"
                      onPress={() => setSelectedWillId(will.id)}
                      contentStyle={styles.willButtonContent}
                      style={styles.willButton}
                    >
                      <View style={styles.willRow}>
                        <View style={[styles.willIcon, { backgroundColor: colors.bg }]}>
                          <Ionicons name={icon as any} size={24} color={colors.text} />
                        </View>
                        <View style={styles.willInfo}>
                          <Text variant="titleSmall" style={styles.willName}>
                            {will.name}
                          </Text>
                          <View style={styles.willMeta}>
                            <Chip
                              compact
                              style={[styles.statusChip, { backgroundColor: colors.bg }]}
                              textStyle={{ color: colors.text }}
                            >
                              {will.status}
                            </Chip>
                            <Text variant="bodySmall" style={styles.willCounts}>
                              {will._count?.beneficiaries || 0} beneficiaries
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#757575" />
                      </View>
                    </Button>
                    {index < wills.length - 1 && <Divider style={styles.divider} />}
                  </React.Fragment>
                );
              })}
            </Card.Content>
          </Card>
        )}

        {/* Selected Will Details */}
        {selectedWill && (
          <Card style={styles.detailsCard}>
            <Card.Content>
              <View style={styles.detailsHeader}>
                <Text variant="titleLarge" style={styles.detailsTitle}>
                  {selectedWill.name}
                </Text>
                <Button mode="text" onPress={() => setSelectedWillId(null)}>
                  Close
                </Button>
              </View>

              {/* Validation Errors */}
              {validationResult && !validationResult.isValid && (
                <View style={styles.validationAlert}>
                  <Ionicons name="alert-circle" size={20} color="#F44336" />
                  <View style={styles.validationContent}>
                    <Text variant="bodyMedium" style={styles.validationTitle}>
                      Cannot activate will:
                    </Text>
                    {validationResult.errors.map((error, index) => (
                      <Text key={index} variant="bodySmall" style={styles.validationError}>
                        • {error}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Beneficiaries */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="people" size={20} color="#4CAF50" />
                  <Text variant="titleSmall" style={styles.sectionHeaderText}>
                    Beneficiaries ({selectedWill.beneficiaries?.length || 0})
                  </Text>
                </View>
                {selectedWill.beneficiaries && selectedWill.beneficiaries.length > 0 ? (
                  selectedWill.beneficiaries.map((beneficiary) => (
                    <View key={beneficiary.id} style={styles.personRow}>
                      <View style={styles.personInfo}>
                        <Text variant="bodyLarge" style={styles.personName}>
                          {beneficiary.beneficiary?.user.name || 'Unknown'}
                        </Text>
                        <Text variant="bodySmall" style={styles.personDetail}>
                          {beneficiary.assetType.replace('_', ' ')} - {beneficiary.percentage}%
                        </Text>
                      </View>
                      <Chip compact>{beneficiary.beneficiary?.relationship}</Chip>
                    </View>
                  ))
                ) : (
                  <Text variant="bodySmall" style={styles.emptySection}>
                    No beneficiaries added yet
                  </Text>
                )}
              </View>

              {/* Executors */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="shield-checkmark" size={20} color="#2196F3" />
                  <Text variant="titleSmall" style={styles.sectionHeaderText}>
                    Executors ({selectedWill.executors?.length || 0})
                  </Text>
                </View>
                {selectedWill.executors && selectedWill.executors.length > 0 ? (
                  selectedWill.executors.map((executor) => (
                    <View key={executor.id} style={styles.personRow}>
                      <View style={styles.personInfo}>
                        <Text variant="bodyLarge" style={styles.personName}>
                          {executor.executor?.user.name || 'Unknown'}
                        </Text>
                        <Text variant="bodySmall" style={styles.personDetail}>
                          Order: {executor.order}
                        </Text>
                      </View>
                      <View style={styles.executorBadges}>
                        {executor.isPrimary && (
                          <Chip compact style={styles.primaryChip}>
                            Primary
                          </Chip>
                        )}
                        <Chip compact>{executor.executor?.relationship}</Chip>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text variant="bodySmall" style={styles.emptySection}>
                    No executors assigned yet
                  </Text>
                )}
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                {selectedWill.status === 'draft' && (
                  <Button
                    mode="contained"
                    buttonColor="#4CAF50"
                    onPress={() => handleActivateWill(selectedWill.id)}
                    disabled={validationResult && !validationResult.isValid}
                    loading={activateMutation.isPending}
                    style={styles.actionButton}
                  >
                    Activate Will
                  </Button>
                )}
                {selectedWill.status === 'active' && (
                  <Button
                    mode="contained"
                    buttonColor="#F44336"
                    onPress={() => handleRevokeWill(selectedWill.id)}
                    loading={revokeMutation.isPending}
                    style={styles.actionButton}
                  >
                    Revoke Will
                  </Button>
                )}
              </View>
            </Card.Content>
          </Card>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* FAB */}
      {selectedHouseholdId && wills && wills.length > 0 && (
        <FAB
          icon="add"
          style={styles.fab}
          onPress={() => setShowCreateDialog(true)}
          color="#FFFFFF"
        />
      )}

      {/* Create Will Dialog */}
      <Portal>
        <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)}>
          <Dialog.Title>Create New Will</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.dialogDescription}>
              Create a draft will. You can add beneficiaries and executors before activating.
            </Text>
            <TextInput
              label="Will Name"
              value={willName}
              onChangeText={setWillName}
              mode="outlined"
              placeholder="e.g., Smith Family Will 2025"
              style={styles.dialogInput}
            />
            <TextInput
              label="Notes (optional)"
              value={willNotes}
              onChangeText={setWillNotes}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.dialogInput}
            />
            <View style={styles.disclaimerRow}>
              <Checkbox
                status={acceptedDisclaimer ? 'checked' : 'unchecked'}
                onPress={() => setAcceptedDisclaimer(!acceptedDisclaimer)}
              />
              <Text variant="bodySmall" style={styles.disclaimerText}>
                I understand this is a digital will and should consult legal counsel
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onPress={handleCreateWill}
              loading={createMutation.isPending}
              disabled={!willName.trim() || !acceptedDisclaimer}
            >
              Create Draft
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
    backgroundColor: '#F3E5F5',
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
  householdSelector: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  householdChip: {
    marginRight: 8,
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
  willsCard: {
    margin: 16,
    marginTop: 8,
    elevation: 1,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  willButton: {
    flex: 1,
  },
  willButtonContent: {
    justifyContent: 'flex-start',
  },
  willRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  willIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  willInfo: {
    flex: 1,
    marginLeft: 12,
  },
  willName: {
    fontWeight: '600',
    color: '#212121',
  },
  willMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusChip: {
    height: 22,
  },
  willCounts: {
    color: '#757575',
  },
  divider: {
    marginVertical: 4,
  },
  detailsCard: {
    margin: 16,
    marginTop: 8,
    elevation: 2,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailsTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  validationAlert: {
    flexDirection: 'row',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 12,
  },
  validationContent: {
    flex: 1,
  },
  validationTitle: {
    fontWeight: '600',
    color: '#C62828',
    marginBottom: 4,
  },
  validationError: {
    color: '#C62828',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontWeight: '600',
    color: '#212121',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontWeight: '600',
    color: '#212121',
  },
  personDetail: {
    color: '#757575',
    textTransform: 'capitalize',
  },
  executorBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  primaryChip: {
    backgroundColor: '#E8F5E9',
  },
  emptySection: {
    color: '#757575',
    fontStyle: 'italic',
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#9C27B0',
  },
  dialogDescription: {
    color: '#757575',
    marginBottom: 12,
  },
  dialogInput: {
    marginTop: 12,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  disclaimerText: {
    flex: 1,
    color: '#424242',
  },
  bottomPadding: {
    height: 80,
  },
});
