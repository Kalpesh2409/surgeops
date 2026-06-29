import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STORES = [
  { id: 'store-mumbai-bandra', name: 'SurgeOps Bandra West' },
  { id: 'store-pune-kothrud', name: 'SurgeOps Kothrud' },
  { id: 'store-bangalore-koramangala', name: 'SurgeOps Koramangala' },
  { id: 'store-delhi-noida', name: 'SurgeOps Noida Sector 18' },
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
          {STORES.map((store) => (
            <SelectItem key={store.id} value={store.id}>
              {store.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}