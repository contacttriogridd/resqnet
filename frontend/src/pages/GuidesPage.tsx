import { BookOpen, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { GUIDE_ICON } from '../components/guideIcons';
import { Badge, PageHeader } from '../components/ui';
import { useDataset } from '../hooks/useOfflineData';

export default function GuidesPage() {
  const guides = useDataset('guides');
  const sorted = [...guides.data].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div>
      <PageHeader
        back="/"
        title="Disaster safety guide"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            What to do before, during and after. <Badge tone="safe">Works offline</Badge>
          </span>
        }
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {sorted.map((g) => {
          const Icon = GUIDE_ICON[g.disasterTypeCode] ?? BookOpen;
          return (
            <li key={g.slug}>
              <Link
                to={`/guides/${g.slug}`}
                className="flex min-h-20 items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-line-strong"
              >
                <Icon className="size-8 shrink-0 text-info" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold">{g.title}</span>
                  <span className="block text-muted">{g.summary}</span>
                </span>
                <ChevronRight className="size-6 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted">
        General guidance based on public-safety advice (NDMA, Red Cross). Always follow instructions from local
        authorities.
      </p>
    </div>
  );
}
