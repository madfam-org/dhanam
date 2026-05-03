'use client';

import { Card, Input, Button, Badge, Skeleton } from '@dhanam/ui';
import { Search, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { SpaceDetailsModal } from '~/components/admin/space-details-modal';
import { adminApi, type SpaceInfo } from '~/lib/api/admin';

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<SpaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSpace, setSelectedSpace] = useState<SpaceInfo | null>(null);

  const loadSpaces = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.searchSpaces({ query, page, limit: 20 });
      setSpaces(response.data);
      setTotalPages(response.totalPages);
    } catch (error) {
      console.error('Failed to load spaces:', error);
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    loadSpaces();
  }, [page, loadSpaces]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadSpaces();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Spaces</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Search and manage spaces</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSearch} className="flex space-x-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search by space name or owner email..."
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Button type="submit" className="flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <span>Search</span>
          </Button>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Space
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Members
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <SpacesTableSkeleton />
              ) : spaces.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No spaces found
                  </td>
                </tr>
              ) : (
                spaces.map((space) => (
                  <tr key={space.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {space.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {space.currency}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={space.type === 'personal' ? 'default' : 'secondary'}>
                        {space.type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {space.members.length} member{space.members.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {space.accountCount} accounts
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {space.budgetCount} budgets
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Button variant="outline" size="sm" onClick={() => setSelectedSpace(space)}>
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center space-x-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </Button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center space-x-2"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {selectedSpace && (
        <SpaceDetailsModal space={selectedSpace} onClose={() => setSelectedSpace(null)} />
      )}
    </div>
  );
}

function SpacesTableSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i}>
          <td className="px-6 py-4">
            <div className="flex items-center">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="ml-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </td>
          <td className="px-6 py-4">
            <Skeleton className="h-6 w-20" />
          </td>
          <td className="px-6 py-4">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="px-6 py-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </td>
          <td className="px-6 py-4">
            <Skeleton className="h-8 w-24" />
          </td>
        </tr>
      ))}
    </>
  );
}
