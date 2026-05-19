import React, { useState, useCallback } from 'react';
import { ScrollView, RefreshControl, Alert } from 'react-native';

import {
  useManualAssets,
  useCreateManualAsset,
  useDeleteManualAsset,
  ManualAsset,
  CreateManualAssetDto,
  ASSET_TYPES,
  AssetType,
} from '@/hooks/api/useAssets';
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
} from '@/lib/react-native-compat';

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const ASSET_COLORS: Record<string, { bg: string; icon: string }> = {
  real_estate: { bg: '#E3F2FD', icon: '#2196F3' },
  vehicle: { bg: '#E8F5E9', icon: '#4CAF50' },
  domain: { bg: '#F3E5F5', icon: '#9C27B0' },
  private_equity: { bg: '#FFF3E0', icon: '#FF9800' },
  angel_investment: { bg: '#FFEBEE', icon: '#F44336' },
  collectible: { bg: '#FCE4EC', icon: '#E91E63' },
  art: { bg: '#E8EAF6', icon: '#3F51B5' },
  jewelry: { bg: '#FFFDE7', icon: '#FFC107' },
  other: { bg: '#F5F5F5', icon: '#757575' },
};

export default function AssetsScreen() {
  const { currentSpace } = useSpaces();
  const currency = currentSpace?.currency || 'USD';

  const [refreshing, setRefreshing] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);

  // Form state
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('other');
  const [assetValue, setAssetValue] = useState('');
  const [assetDescription, setAssetDescription] = useState('');

  const { data: assets, isLoading, refetch } = useManualAssets();
  const createMutation = useCreateManualAsset();
  const deleteMutation = useDeleteManualAsset();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const resetForm = () => {
    setAssetName('');
    setAssetType('other');
    setAssetValue('');
    setAssetDescription('');
  };

  const handleCreateAsset = async () => {
    if (!assetName.trim()) {
      Alert.alert('Error', 'Please enter an asset name');
      return;
    }
    const value = parseFloat(assetValue);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Error', 'Please enter a valid value');
      return;
    }

    const dto: CreateManualAssetDto = {
      name: assetName.trim(),
      type: assetType,
      currentValue: value,
      currency,
      description: assetDescription.trim() || undefined,
    };

    try {
      await createMutation.mutateAsync(dto);
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to create asset');
    }
  };

  const handleDeleteAsset = (asset: ManualAsset) => {
    Alert.alert('Delete Asset', `Are you sure you want to delete "${asset.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync(asset.id);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete asset');
          }
        },
      },
    ]);
  };

  const totalValue = assets?.reduce((sum, asset) => sum + asset.currentValue, 0) || 0;
  const selectedTypeInfo = ASSET_TYPES.find((t) => t.value === assetType);

  if (!currentSpace) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="wallet-outline" size={48} color="#BDBDBD" />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          No space selected
        </Text>
        <Text variant="bodyMedium" style={styles.emptyDescription}>
          Please select a space to manage your assets
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading assets...
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
        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryHeader}>
              <Ionicons name="briefcase" size={28} color="#4CAF50" />
              <Text variant="titleMedium" style={styles.summaryTitle}>
                Portfolio Summary
              </Text>
            </View>
            <Text variant="displaySmall" style={styles.totalValue}>
              {formatCurrency(totalValue, currency)}
            </Text>
            <Text variant="bodySmall" style={styles.assetCount}>
              {assets?.length || 0} assets tracked
            </Text>
          </Card.Content>
        </Card>

        {/* Assets List */}
        {!assets || assets.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyCardContent}>
              <Ionicons name="business-outline" size={48} color="#BDBDBD" />
              <Text variant="titleMedium" style={styles.emptyCardTitle}>
                No assets yet
              </Text>
              <Text variant="bodyMedium" style={styles.emptyCardDescription}>
                Start tracking your illiquid assets like real estate, vehicles, and collectibles
              </Text>
              <Button
                mode="contained"
                buttonColor="#4CAF50"
                onPress={() => setShowCreateDialog(true)}
                style={styles.emptyCardButton}
              >
                Add Your First Asset
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.assetsCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Your Assets
              </Text>
              {assets.map((asset, index) => {
                const typeInfo = ASSET_TYPES.find((t) => t.value === asset.type);
                const colors = ASSET_COLORS[asset.type] || ASSET_COLORS.other;

                return (
                  <React.Fragment key={asset.id}>
                    <View style={styles.assetRow}>
                      <View style={[styles.assetIcon, { backgroundColor: colors.bg }]}>
                        <Ionicons
                          name={(typeInfo?.icon || 'cube-outline') as any}
                          size={24}
                          color={colors.icon}
                        />
                      </View>
                      <View style={styles.assetInfo}>
                        <Text variant="titleSmall" style={styles.assetName}>
                          {asset.name}
                        </Text>
                        <Text variant="bodySmall" style={styles.assetType}>
                          {typeInfo?.label || 'Other'}
                        </Text>
                        {asset.description && (
                          <Text
                            variant="bodySmall"
                            style={styles.assetDescription}
                            numberOfLines={1}
                          >
                            {asset.description}
                          </Text>
                        )}
                      </View>
                      <View style={styles.assetActions}>
                        <Text variant="titleMedium" style={styles.assetValue}>
                          {formatCurrency(asset.currentValue, asset.currency)}
                        </Text>
                        <IconButton
                          icon="trash-outline"
                          size={18}
                          iconColor="#F44336"
                          onPress={() => handleDeleteAsset(asset)}
                        />
                      </View>
                    </View>
                    {index < assets.length - 1 && <Divider style={styles.divider} />}
                  </React.Fragment>
                );
              })}
            </Card.Content>
          </Card>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* FAB */}
      {assets && assets.length > 0 && (
        <FAB
          icon="add"
          style={styles.fab}
          onPress={() => setShowCreateDialog(true)}
          color="#FFFFFF"
        />
      )}

      {/* Create Asset Dialog */}
      <Portal>
        <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)}>
          <Dialog.Title>Add Manual Asset</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Asset Name"
              value={assetName}
              onChangeText={setAssetName}
              mode="outlined"
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
                  contentStyle={styles.typeButtonContent}
                >
                  <View style={styles.typeButtonInner}>
                    <Ionicons
                      name={(selectedTypeInfo?.icon || 'cube-outline') as any}
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
              {ASSET_TYPES.map((type) => (
                <Menu.Item
                  key={type.value}
                  onPress={() => {
                    setAssetType(type.value);
                    setTypeMenuVisible(false);
                  }}
                  title={type.label}
                  leadingIcon={type.icon as any}
                />
              ))}
            </Menu>
            <TextInput
              label="Current Value"
              value={assetValue}
              onChangeText={setAssetValue}
              keyboardType="decimal-pad"
              mode="outlined"
              left={<TextInput.Affix text="$" />}
              style={styles.dialogInput}
            />
            <TextInput
              label="Description (optional)"
              value={assetDescription}
              onChangeText={setAssetDescription}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onPress={handleCreateAsset} loading={createMutation.isPending}>
              Add Asset
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontWeight: '600',
    color: '#212121',
    marginTop: 16,
  },
  emptyDescription: {
    color: '#757575',
    marginTop: 8,
    textAlign: 'center',
  },
  summaryCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
    backgroundColor: '#E8F5E9',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  summaryTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  totalValue: {
    fontWeight: '700',
    color: '#2E7D32',
    marginTop: 8,
  },
  assetCount: {
    color: '#757575',
    marginTop: 4,
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
  assetsCard: {
    margin: 16,
    marginTop: 8,
    elevation: 1,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  assetIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  assetName: {
    fontWeight: '600',
    color: '#212121',
  },
  assetType: {
    color: '#757575',
    marginTop: 2,
  },
  assetDescription: {
    color: '#9E9E9E',
    marginTop: 2,
  },
  assetActions: {
    alignItems: 'flex-end',
  },
  assetValue: {
    fontWeight: '600',
    color: '#4CAF50',
  },
  divider: {
    marginVertical: 0,
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
  typeButtonContent: {
    justifyContent: 'flex-start',
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
