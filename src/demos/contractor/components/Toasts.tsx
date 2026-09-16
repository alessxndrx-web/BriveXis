import { Toasts as SharedToasts } from '../../shared/ui/Toasts';
import { useContractor } from '../ContractorProvider';

/** Binds the shared notification stack to the contractor workspace. */
export function Toasts() {
  const { toasts, dismissToast } = useContractor();
  return <SharedToasts toasts={toasts} onDismiss={dismissToast} />;
}
