import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-64">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500/30" />
          <p className="mt-3 text-sm text-gray-600">Loading equipment data...</p>
        </CardContent>
      </Card>
    </div>
  );
}