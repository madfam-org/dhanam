'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dhanam/ui';
import { Search, Loader2, Package } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import {
  collectiblesApi,
  type CollectibleCategory,
  type CollectibleSearchResult,
} from '@/lib/api/collectibles';

interface CollectibleLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  assetId: string;
  onLinked: () => void;
}

export function CollectibleLinkModal({
  open,
  onOpenChange,
  spaceId,
  assetId,
  onLinked,
}: CollectibleLinkModalProps) {
  const [categories, setCategories] = useState<CollectibleCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CollectibleSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingCategories(true);
    collectiblesApi
      .getCategories(spaceId)
      .then(setCategories)
      .catch(() => setError('Failed to load categories'))
      .finally(() => setLoadingCategories(false));
  }, [open, spaceId]);

  const handleSearch = useCallback(async () => {
    if (!selectedCategory || !query.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const data = await collectiblesApi.search(spaceId, selectedCategory, query.trim());
      setResults(data);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [spaceId, selectedCategory, query]);

  // Debounced search
  useEffect(() => {
    if (!selectedCategory || query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(handleSearch, 400);
    return () => clearTimeout(timer);
  }, [query, selectedCategory, handleSearch]);

  const handleSelect = async (item: CollectibleSearchResult) => {
    setIsLinking(true);
    setError(null);
    try {
      await collectiblesApi.link(spaceId, assetId, {
        category: item.category,
        provider: item.provider,
        externalId: item.externalId,
      });
      onLinked();
      onOpenChange(false);
    } catch {
      setError('Failed to link collectible. Please try again.');
    } finally {
      setIsLinking(false);
    }
  };

  const formatCurrency = (value?: number) => {
    if (value == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Link to Collectible Provider
          </DialogTitle>
          <DialogDescription>
            Search for your collectible to enable automatic valuations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category Selector */}
          <Select
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            disabled={loadingCategories}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingCategories ? 'Loading...' : 'Select category'} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.slug} value={cat.slug}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, model, SKU..."
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              className="pl-9"
              disabled={!selectedCategory}
            />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Results */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {isSearching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isSearching && results.length === 0 && query.length >= 2 && selectedCategory && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No results found. Try a different search term.
              </p>
            )}

            {!isSearching &&
              results.map((item) => (
                <button
                  key={`${item.provider}-${item.externalId}`}
                  onClick={() => handleSelect(item)}
                  disabled={isLinking}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.provider} · {formatCurrency(item.marketValue)}
                    </p>
                  </div>
                  {isLinking && <Loader2 className="h-4 w-4 animate-spin" />}
                </button>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
