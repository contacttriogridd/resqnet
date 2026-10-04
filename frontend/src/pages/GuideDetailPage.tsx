import { BookOpen, Siren } from 'lucide-react';
import { useParams } from 'react-router';
import { ButtonLink, Card, EmptyState, PageHeader } from '../components/ui';
import { useDataset } from '../hooks/useOfflineData';
import { GUIDE_ICON } from '../components/guideIcons';

export default function GuideDetailPage() {
  const { slug } = useParams();
  const guides = useDataset('guides');
  const guide = guides.data.find((g) => g.slug === slug);

  if (!guide) {
    return (
      <EmptyState icon={BookOpen} title="Guide not found" action={<ButtonLink to="/guides">All guides</ButtonLink>} />
    );
  }
  const Icon = GUIDE_ICON[guide.disasterTypeCode] ?? BookOpen;
  const isWarning = (title: string) => /not|don't/i.test(title);

  return (
    <article>
      <PageHeader back="/guides" title={guide.title} subtitle={guide.summary} />
      <div className="space-y-4">
        {guide.sections.map((s) => (
          <Card key={s.title} className={isWarning(s.title) ? 'border-2 border-critical-line' : undefined}>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
              {s.title === guide.sections[0]?.title && <Icon className="size-6 text-info" aria-hidden />}
              {s.title}
            </h2>
            <ol className="space-y-3">
              {s.items.map((item, i) => (
                <li key={i} className="flex gap-3 text-lg leading-snug">
                  <span
                    className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-base font-bold"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <ButtonLink to="/sos" variant="emergency" size="lg" icon={Siren} block>
          I need help now
        </ButtonLink>
      </div>
    </article>
  );
}
