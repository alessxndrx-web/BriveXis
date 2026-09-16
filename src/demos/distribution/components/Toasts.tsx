import { Toasts as SharedToasts } from '../../shared/ui/Toasts';
import { useDistribution } from '../DistributionProvider';

/** Binds the shared notification stack to the distribution workspace. */
export function Toasts() {
  const { toasts, dismissToast } = useDistribution();
  return <SharedToasts toasts={toasts} onDismiss={dismissToast} />;
}
