import { Wifi, WifiOff, WifiLow } from 'lucide-react';
import { Link } from 'react-router';
import { useNetwork } from '../../hooks/useStore';
import { cn } from '../../utils/cn';

/** Header status pill: icon + text + colour (never colour alone). */
export function ConnectionIndicator() {
  const net = useNetwork();
  const view =
    net.state === 'online'
      ? { Icon: Wifi, label: 'Online', cls: 'bg-safe-bg text-safe border-safe-line' }
      : net.state === 'limited'
        ? { Icon: WifiLow, label: 'Limited', cls: 'bg-warning-bg text-warning border-warning-line' }
        : { Icon: WifiOff, label: net.simulated ? 'Offline (demo)' : 'Offline', cls: 'bg-critical-bg text-critical border-critical-line' };

  return (
    <Link
      to="/offline"
      className={cn(
        'inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-bold',
        view.cls,
        net.checking && 'opacity-70',
      )}
      aria-label={`Connection: ${view.label}. Open offline data center.`}
    >
      <view.Icon className="size-4" aria-hidden />
      <span>{view.label}</span>
    </Link>
  );
}
