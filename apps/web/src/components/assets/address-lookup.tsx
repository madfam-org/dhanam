'use client';

import { Search, MapPin, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AddressLookupProps {
  onAddressSelected: (address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    zpid?: string;
  }) => void;
  initialValues?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
];

export function AddressLookup({ onAddressSelected, initialValues }: AddressLookupProps) {
  const [street, setStreet] = useState(initialValues?.street || '');
  const [city, setCity] = useState(initialValues?.city || '');
  const [state, setState] = useState(initialValues?.state || '');
  const [zip, setZip] = useState(initialValues?.zip || '');
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    found: boolean;
    zpid?: string;
    formattedAddress?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!street || !city || !state) {
      setError('Please enter street address, city, and state');
      return;
    }

    setIsSearching(true);
    setError(null);
    setLookupResult(null);

    try {
      // This would typically call a backend API that wraps the Zillow lookup
      // For now, we simulate the lookup
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulated result
      const mockZpid = `mock-${Buffer.from(`${street}${city}${state}`).toString('hex').slice(0, 8)}`;
      setLookupResult({
        found: true,
        zpid: mockZpid,
        formattedAddress: `${street}, ${city}, ${state} ${zip}`.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to look up address');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    onAddressSelected({
      street,
      city,
      state,
      zip,
      zpid: lookupResult?.zpid,
    });
  };

  const handleSkip = () => {
    onAddressSelected({
      street,
      city,
      state,
      zip,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <Label htmlFor="street">Street Address</Label>
          <Input
            id="street"
            placeholder="123 Main St"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="Los Angeles"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger id="state">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="w-1/2">
          <Label htmlFor="zip">ZIP Code (optional)</Label>
          <Input
            id="zip"
            placeholder="90210"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            maxLength={10}
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {lookupResult && (
        <Alert variant={lookupResult.found ? 'default' : 'destructive'}>
          {lookupResult.found ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">{lookupResult.formattedAddress}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Found in Zillow database. Automatic valuations available.
                </p>
              </AlertDescription>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Address not found in Zillow database. You can still add the property with manual
                valuations.
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      <div className="flex gap-3">
        <Button onClick={handleLookup} disabled={isSearching || !street || !city || !state}>
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Look up in Zillow
            </>
          )}
        </Button>

        {lookupResult?.found && (
          <Button onClick={handleConfirm} variant="default">
            <CheckCircle className="h-4 w-4 mr-2" />
            Use This Address
          </Button>
        )}

        <Button onClick={handleSkip} variant="ghost">
          Skip Zillow Lookup
        </Button>
      </div>
    </div>
  );
}
