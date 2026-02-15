'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FalseCallReasonsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/engineering/master-data?tab=false-call-reasons');
  }, [router]);

  return null;
}
