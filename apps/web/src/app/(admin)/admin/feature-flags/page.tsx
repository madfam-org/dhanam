'use client';

import { Card, Button, Switch, Badge, Input, Label, Skeleton } from '@dhanam/ui';
import { Flag, Users, Percent, Edit2, Save, X } from 'lucide-react';
import { useState } from 'react';

import { useAdmin } from '~/contexts/AdminContext';
import type { FeatureFlag } from '~/lib/api/admin';

export default function FeatureFlagsPage() {
  const { featureFlags, isLoading, updateFeatureFlag } = useAdmin();
  const [editingFlag, setEditingFlag] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<FeatureFlag>>({});

  const handleEdit = (flag: FeatureFlag) => {
    setEditingFlag(flag.key);
    setEditValues({
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      targetedUsers: flag.targetedUsers,
    });
  };

  const handleSave = async (key: string) => {
    try {
      await updateFeatureFlag(key, editValues);
      setEditingFlag(null);
      setEditValues({});
    } catch (error) {
      console.error('Failed to update feature flag:', error);
    }
  };

  const handleCancel = () => {
    setEditingFlag(null);
    setEditValues({});
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      await updateFeatureFlag(flag.key, { enabled: !flag.enabled });
    } catch (error) {
      console.error('Failed to toggle feature flag:', error);
    }
  };

  if (isLoading) {
    return <FeatureFlagsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feature Flags</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage feature rollouts and experiments
        </p>
      </div>

      <div className="grid gap-4">
        {featureFlags.map((flag) => {
          const isEditing = editingFlag === flag.key;

          return (
            <Card key={flag.key} className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <Flag className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {flag.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {flag.description}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant={flag.enabled ? 'default' : 'secondary'}>
                          {flag.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        {flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100 && (
                          <Badge variant="outline" className="flex items-center space-x-1">
                            <Percent className="h-3 w-3" />
                            <span>{flag.rolloutPercentage}% rollout</span>
                          </Badge>
                        )}
                        {flag.targetedUsers && flag.targetedUsers.length > 0 && (
                          <Badge variant="outline" className="flex items-center space-x-1">
                            <Users className="h-3 w-3" />
                            <span>{flag.targetedUsers.length} targeted users</span>
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="flex items-center space-x-2">
                      <Switch checked={flag.enabled} onCheckedChange={() => handleToggle(flag)} />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(flag)}
                        className="flex items-center space-x-1"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span>Edit</span>
                      </Button>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`${flag.key}-enabled`}>Status</Label>
                        <div className="flex items-center space-x-2 mt-2">
                          <Switch
                            id={`${flag.key}-enabled`}
                            checked={editValues.enabled}
                            onCheckedChange={(checked: boolean) =>
                              setEditValues({ ...editValues, enabled: checked })
                            }
                          />
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {editValues.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`${flag.key}-rollout`}>Rollout Percentage</Label>
                        <Input
                          id={`${flag.key}-rollout`}
                          type="number"
                          min="0"
                          max="100"
                          value={editValues.rolloutPercentage || 100}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setEditValues({
                              ...editValues,
                              rolloutPercentage: parseInt(e.target.value),
                            })
                          }
                          className="mt-2"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`${flag.key}-users`}>
                        Targeted Users (comma-separated IDs)
                      </Label>
                      <Input
                        id={`${flag.key}-users`}
                        type="text"
                        value={editValues.targetedUsers?.join(', ') || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setEditValues({
                            ...editValues,
                            targetedUsers: e.target.value
                              .split(',')
                              .map((id) => id.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="user-id-1, user-id-2"
                        className="mt-2"
                      />
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        className="flex items-center space-x-1"
                      >
                        <X className="h-4 w-4" />
                        <span>Cancel</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave(flag.key)}
                        className="flex items-center space-x-1"
                      >
                        <Save className="h-4 w-4" />
                        <span>Save</span>
                      </Button>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Key:{' '}
                  <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                    {flag.key}
                  </code>
                  {' • '}
                  Updated: {new Date(flag.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FeatureFlagsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      <div className="grid gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Skeleton className="h-5 w-5 rounded" />
                <div>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-96 mt-2" />
                  <div className="flex items-center space-x-2 mt-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-6 w-10 rounded-full" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
