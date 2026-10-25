import type { Metadata } from 'next';
import { Play } from '@/components/lane/play';
import { TAGLINE } from '@/lib/config/site';

export const metadata: Metadata = {
  title: 'Play · Alpie Pong',
  description: TAGLINE,
};

export default function Page() {
  return <Play />;
}
