import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Label3D } from '@/components/label-3d/Label3D';
import { useDbChanged } from '@/hooks/useDbChanged';

export const Route = createFileRoute('/label')({
  component: LabelRouteComponent,
});

function LabelRouteComponent() {
  const [key, setKey] = useState(0);
  useDbChanged();

  return <Label3D key={key} onReset={() => setKey((k) => k + 1)} />;
}
