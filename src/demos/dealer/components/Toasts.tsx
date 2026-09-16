import { Toasts as SharedToasts } from '../../shared/ui/Toasts';
import { useDealer } from '../DealerProvider';

/** Binds the shared notification stack to the dealer workspace. */
export function Toasts() {
  const { toasts, dismissToast } = useDealer();
  return <SharedToasts toasts={toasts} onDismiss={dismissToast} />;
}
