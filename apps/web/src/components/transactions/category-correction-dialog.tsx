'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Checkbox,
  Label,
  Badge,
} from '@dhanam/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles, Check } from 'lucide-react';
import { useState } from 'react';

import { useAnalytics } from '@/hooks/useAnalytics';
import { categoriesApi } from '@/lib/api/categories';
import { mlApi } from '@/lib/api/ml';
import { cn } from '@/lib/utils';
import { useSpaceStore } from '@/stores/space';

interface CategoryCorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: {
    id: string;
    description: string;
    merchant: string | null;
    amount: number;
    categoryId: string | null;
  };
  onCorrectionComplete?: () => void;
}

export function CategoryCorrectionDialog({
  open,
  onOpenChange,
  transaction,
  onCorrectionComplete,
}: CategoryCorrectionDialogProps) {
  const { currentSpace } = useSpaceStore();
  const queryClient = useQueryClient();
  const analytics = useAnalytics();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    transaction.categoryId
  );
  const [applyToFuture, setApplyToFuture] = useState(true);

  // Fetch categories
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories', currentSpace?.id],
    queryFn: () => {
      if (!currentSpace) throw new Error('No current space');
      return categoriesApi.getCategories(currentSpace.id);
    },
    enabled: !!currentSpace && open,
  });

  // Fetch ML prediction
  const { data: prediction } = useQuery({
    queryKey: ['ml-prediction', currentSpace?.id, transaction.id],
    queryFn: () => {
      if (!currentSpace) throw new Error('No current space');
      return mlApi.predictCategory(currentSpace.id, transaction.id);
    },
    enabled: !!currentSpace && open && !transaction.categoryId,
  });

  // Correction mutation
  const correctionMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      if (!currentSpace) throw new Error('No current space');
      return mlApi.correctCategory(currentSpace.id, transaction.id, categoryId, applyToFuture);
    },
    onSuccess: (_data, categoryId) => {
      analytics.trackTxnCategorized(transaction.id, categoryId, 'manual');
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['ml-learned-patterns'] });
      queryClient.invalidateQueries({ queryKey: ['ml-insights'] });

      onCorrectionComplete?.();
      onOpenChange(false);
    },
  });

  const handleCorrect = () => {
    if (selectedCategoryId) {
      correctionMutation.mutate(selectedCategoryId);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return (
        <Badge variant="default" className="bg-green-500">
          High confidence
        </Badge>
      );
    } else if (confidence >= 0.7) {
      return <Badge variant="secondary">Medium confidence</Badge>;
    } else {
      return <Badge variant="outline">Low confidence</Badge>;
    }
  };

  const getSourceLabel = (source?: string) => {
    switch (source) {
      case 'correction':
        return 'From your corrections';
      case 'fuzzy':
        return 'Similar merchant match';
      case 'merchant':
        return 'Historical pattern';
      case 'keyword':
        return 'Description keywords';
      case 'amount':
        return 'Amount pattern';
      default:
        return 'ML prediction';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Categorize Transaction
          </DialogTitle>
          <DialogDescription>
            {transaction.merchant || transaction.description}
            <span className="block text-sm text-muted-foreground mt-1">
              ${Math.abs(transaction.amount).toFixed(2)}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* ML Prediction Suggestion */}
        {prediction && !transaction.categoryId && (
          <div className="bg-muted/50 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Suggestion
              </span>
              {getConfidenceBadge(prediction.confidence)}
            </div>
            <p className="text-sm font-semibold">{prediction.categoryName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {getSourceLabel(prediction.source)}: {prediction.reasoning}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 w-full"
              onClick={() => {
                setSelectedCategoryId(prediction.categoryId);
              }}
            >
              <Check className="h-4 w-4 mr-1" />
              Accept suggestion
            </Button>
          </div>
        )}

        {/* Category List */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Select category</Label>
          {isLoadingCategories ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="h-[200px] overflow-y-auto rounded-md border p-2">
              <div className="space-y-1">
                {categories?.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={cn(
                      'w-full flex items-center justify-between p-2 rounded-md text-sm transition-colors',
                      selectedCategoryId === category.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {category.icon && <span>{category.icon}</span>}
                      <span>{category.name}</span>
                    </div>
                    {selectedCategoryId === category.id && <Check className="h-4 w-4" />}
                    {prediction?.categoryId === category.id &&
                      selectedCategoryId !== category.id && (
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                      )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Apply to Future Toggle */}
        <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
          <Checkbox
            id="applyToFuture"
            checked={applyToFuture}
            onCheckedChange={(checked) => setApplyToFuture(checked as boolean)}
          />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="applyToFuture" className="text-sm font-medium cursor-pointer">
              Apply to future transactions
            </Label>
            <p className="text-xs text-muted-foreground">
              Similar transactions from {transaction.merchant || 'this merchant'} will be
              auto-categorized
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCorrect}
            disabled={!selectedCategoryId || correctionMutation.isPending}
          >
            {correctionMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Category'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
