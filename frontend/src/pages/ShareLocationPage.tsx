import { formatCoordinates } from '@resqnet/shared';
import { Copy, Crosshair, MessageSquare, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Notice, PageHeader } from '../components/ui';
import { GEO_MESSAGES, useGeolocation } from '../hooks/useGeolocation';

/**
 * Share your position with family or responders. SMS goes over the mobile
 * network and can work when mobile data/internet does not.
 */
export default function ShareLocationPage() {
  const geo = useGeolocation();
  const [copied, setCopied] = useState(false);
  const p = geo.position;
  const message = p
    ? `I need help. My location: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)} (accuracy ~${p.accuracyMeters} m). ` +
      `Map: https://maps.google.com/?q=${p.latitude.toFixed(5)},${p.longitude.toFixed(5)} — sent from RESQNET`
    : '';

  const share = async () => {
    try {
      await navigator.share({ title: 'My location', text: message });
    } catch {
      /* user cancelled */
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader back="/" title="Share my location" subtitle="Send your position to family or responders." />
      <Notice tone="info">
        Your location is only shared when you press a share button. GPS works without internet; sending a text message
        needs mobile signal but not mobile data.
      </Notice>

      {!p ? (
        <Button variant="primary" size="lg" block icon={Crosshair} loading={geo.status === 'locating'} onClick={() => void geo.locate()}>
          Find my location
        </Button>
      ) : (
        <Card className="space-y-3">
          <p className="text-lg font-bold">Your location</p>
          <p className="tabular text-lg">{formatCoordinates(p)}</p>
          <p className="text-sm text-muted">Accurate to about {p.accuracyMeters} m.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <a
              href={`sms:?&body=${encodeURIComponent(message)}`}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-info px-4 font-semibold text-white"
            >
              <MessageSquare className="size-5" aria-hidden /> Send by SMS
            </a>
            {'share' in navigator && (
              <Button size="lg" icon={Share2} onClick={share}>
                Share…
              </Button>
            )}
            <Button size="lg" icon={Copy} onClick={copy}>
              {copied ? 'Copied' : 'Copy text'}
            </Button>
          </div>
          <Button variant="ghost" icon={Crosshair} onClick={() => void geo.locate()}>
            Update location
          </Button>
        </Card>
      )}

      {(geo.status === 'denied' || geo.status === 'unavailable' || geo.status === 'timeout' || geo.status === 'unsupported') && (
        <Notice tone="warning">{GEO_MESSAGES[geo.status]} You can describe your location in a message instead.</Notice>
      )}
    </div>
  );
}
