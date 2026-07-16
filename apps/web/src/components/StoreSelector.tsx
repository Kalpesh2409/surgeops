import { Fragment } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STORES = [
  { id: 'store-mumbai-bandra', name: 'Mumbai - Bandra West' },
  { id: 'store-pune-kothrud', name: 'Pune - Kothrud' },
  { id: 'store-bangalore-koramangala', name: 'Bangalore - Koramangala' },
  { id: 'store-delhi-noida', name: 'Delhi - Noida Sector 18' },
];

interface StoreSelectorProps {
  value: string;
  onChange: (storeId: string) => void;
}

export function StoreSelector({ value, onChange }: StoreSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">Store:</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select a store" />
        </SelectTrigger>
        <SelectContent>
          {STORES.map((store, index) => (
            <Fragment key={store.id}>
              <SelectItem value={store.id}>{store.name}</SelectItem>
              {index < STORES.length - 1 && <SelectSeparator />}
            </Fragment>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}