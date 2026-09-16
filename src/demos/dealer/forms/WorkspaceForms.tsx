import { useMemo } from 'react';
import { useDealer } from '../DealerProvider';
import type { DocumentRecord, DocumentStatus, DocumentType, Task, TaskKind } from '../dealer.types';
import { DOCUMENT_STATUSES, DOCUMENT_TYPES, TASK_KINDS, VEHICLE_TYPES } from '../dealer.types';
import {
  FUEL_TYPES,
  TRANSMISSIONS,
  VEHICLE_CONDITIONS,
} from '../dealer.types';
import { getVehicle } from '../dealer.selectors';
import {
  centsToInput,
  dayOffset,
  demoVin,
  dollarsToCents,
  isValidDemoVin,
  toDateOnly,
  vehicleTitle,
} from '../dealer.utils';
import { Button, FormField, Select, TextArea, TextInput } from '../../shared/ui/AppUI';
import { ConfirmDialog, Dialog } from '../../shared/ui/Dialog';
import {
  MoneyInput,
  NumberInput,
  useForm,
  validPositiveAmount,
  type Errors,
} from '../../shared/ui/formControls';

/**
 * Documents, tasks and inventory entry.
 *
 * Documents are tracked by name and status only. No file is uploaded anywhere
 * and no contents are stored, which is what keeps a public demo from ever
 * holding somebody's identity document. The workspace does not verify
 * authenticity and never claims to.
 */

// --------------------------------------------------------------- documents

interface DocumentFormProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  dealId?: string;
  reservationId?: string;
  /** Pre-selects the type, e.g. when requesting a specific outstanding item. */
  type?: DocumentType;
  document?: DocumentRecord;
}

export function DocumentForm({
  open,
  onClose,
  customerId,
  dealId,
  reservationId,
  type,
  document,
}: DocumentFormProps) {
  const { dispatch, notify } = useDealer();

  const form = useForm({
    type: (document?.type ?? type ?? DOCUMENT_TYPES[0]) as DocumentType,
    status: (document?.status ?? 'Requested') as DocumentStatus,
    fileLabel: document?.fileLabel ?? '',
    notes: document?.notes ?? '',
  });

  const submit = () => {
    if (document) {
      dispatch({
        type: 'document/status',
        id: document.id,
        status: form.values.status,
        fileLabel: form.values.fileLabel.trim() || undefined,
      });
      notify(`${form.values.type} updated.`, 'success');
      onClose();
      return;
    }

    dispatch({
      type: 'document/create',
      input: {
        type: form.values.type,
        status: form.values.status,
        customerId,
        dealId,
        reservationId,
        fileLabel: form.values.fileLabel.trim() || undefined,
        notes: form.values.notes.trim(),
      },
    });
    notify(`${form.values.type} recorded as ${form.values.status.toLowerCase()}.`, 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={document ? `Update ${document.type}` : 'Track a document'}
      description="Only the name and status are recorded. No file is uploaded or stored."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {document ? 'Save' : 'Add document'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormField label="Document" htmlFor="document-type">
          <Select
            id="document-type"
            value={form.values.type}
            disabled={Boolean(document)}
            onChange={(event) => form.set('type', event.target.value as DocumentType)}
          >
            {DOCUMENT_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Status" htmlFor="document-status">
          <Select
            id="document-status"
            value={form.values.status}
            onChange={(event) => form.set('status', event.target.value as DocumentStatus)}
          >
            {DOCUMENT_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="File reference" htmlFor="document-label" optional>
          <TextInput
            id="document-label"
            placeholder="How it was filed, e.g. id-scan.pdf"
            value={form.values.fileLabel}
            onChange={(event) => form.set('fileLabel', event.target.value)}
          />
        </FormField>

        {!document && (
          <FormField label="Notes" htmlFor="document-notes" optional>
            <TextArea
              id="document-notes"
              rows={2}
              value={form.values.notes}
              onChange={(event) => form.set('notes', event.target.value)}
            />
          </FormField>
        )}

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Dialog>
  );
}

// ------------------------------------------------------------------- tasks

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  task?: Task;
  links?: Partial<Pick<Task, 'leadId' | 'customerId' | 'vehicleId' | 'dealId' | 'reservationId'>>;
}

export function TaskForm({ open, onClose, task, links }: TaskFormProps) {
  const { state, dispatch, notify } = useDealer();

  const form = useForm({
    kind: (task?.kind ?? TASK_KINDS[0]) as TaskKind,
    title: task?.title ?? '',
    dueAt: task?.dueAt ?? dayOffset(new Date(), 1),
    assigneeId: task?.assigneeId ?? state.salespeople[3]?.id ?? state.salespeople[0].id,
    notes: task?.notes ?? '',
  });

  const submit = () => {
    const valid = form.validate((values) => ({
      title: values.title.trim() ? undefined : 'Say what needs doing.',
    }));
    if (!valid) return;

    if (task) {
      notify('Task updated.', 'success');
      onClose();
      return;
    }

    dispatch({
      type: 'task/create',
      input: {
        kind: form.values.kind,
        title: form.values.title.trim(),
        dueAt: form.values.dueAt,
        assigneeId: form.values.assigneeId,
        notes: form.values.notes.trim(),
        ...links,
      },
    });
    notify('Task created.', 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New task"
      description="Follow-ups keep leads, reservations and paperwork moving."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Create task
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormField label="Type" htmlFor="task-kind">
          <Select
            id="task-kind"
            value={form.values.kind}
            onChange={(event) => {
              const kind = event.target.value as TaskKind;
              form.set('kind', kind);
              if (!form.values.title.trim()) form.set('title', kind);
            }}
          >
            {TASK_KINDS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="What needs doing" htmlFor="task-title" error={form.errors.title}>
          <TextInput
            id="task-title"
            value={form.values.title}
            invalid={Boolean(form.errors.title)}
            onChange={(event) => form.set('title', event.target.value)}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Due" htmlFor="task-due">
            <TextInput
              id="task-due"
              type="date"
              value={form.values.dueAt}
              onChange={(event) => form.set('dueAt', event.target.value)}
            />
          </FormField>

          <FormField label="Assigned to" htmlFor="task-assignee">
            <Select
              id="task-assignee"
              value={form.values.assigneeId}
              onChange={(event) => form.set('assigneeId', event.target.value)}
            >
              {state.salespeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Notes" htmlFor="task-notes" optional>
          <TextArea
            id="task-notes"
            rows={2}
            value={form.values.notes}
            onChange={(event) => form.set('notes', event.target.value)}
          />
        </FormField>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Create
        </button>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------- vehicles

interface VehicleFormValues {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  type: string;
  mileage: string;
  exteriorColor: string;
  interiorColor: string;
  transmission: string;
  fuelType: string;
  condition: string;
  acquisitionCost: string;
  listPrice: string;
  locationId: string;
  acquiredAt: string;
  notes: string;
}

export function VehicleForm({
  open,
  onClose,
  vehicleId,
}: {
  open: boolean;
  onClose: () => void;
  vehicleId?: string;
}) {
  const { state, dispatch, notify } = useDealer();
  const vehicle = getVehicle(state, vehicleId);

  const initial = useMemo<VehicleFormValues>(
    () => ({
      // A fresh demo identifier, so a new unit looks like the rest of the lot.
      vin: vehicle?.vin ?? demoVin(state.vehicles.length + Date.now() % 1000),
      year: String(vehicle?.year ?? new Date().getFullYear() - 2),
      make: vehicle?.make ?? '',
      model: vehicle?.model ?? '',
      trim: vehicle?.trim ?? '',
      type: vehicle?.type ?? 'SUV',
      mileage: String(vehicle?.mileage ?? ''),
      exteriorColor: vehicle?.exteriorColor ?? '',
      interiorColor: vehicle?.interiorColor ?? '',
      transmission: vehicle?.transmission ?? 'Automatic',
      fuelType: vehicle?.fuelType ?? 'Gasoline',
      condition: vehicle?.condition ?? 'Used',
      acquisitionCost: vehicle ? centsToInput(vehicle.acquisitionCost) : '',
      listPrice: vehicle ? centsToInput(vehicle.listPrice) : '',
      locationId: vehicle?.locationId ?? state.locations[0].id,
      acquiredAt: vehicle?.acquiredAt ?? toDateOnly(new Date()),
      notes: vehicle?.notes ?? '',
    }),
    [vehicle, state.vehicles.length, state.locations],
  );

  const form = useForm<VehicleFormValues>(initial);

  const validate = (values: VehicleFormValues): Errors<VehicleFormValues> => {
    const errors: Errors<VehicleFormValues> = {};
    if (!values.make.trim()) errors.make = 'Enter the make.';
    if (!values.model.trim()) errors.model = 'Enter the model.';
    if (!isValidDemoVin(values.vin)) {
      errors.vin = 'A VIN is 17 characters and never uses I, O or Q.';
    }
    errors.listPrice = validPositiveAmount(values.listPrice, 'List price');
    return errors;
  };

  const submit = () => {
    if (!form.validate(validate)) return;

    const input = {
      vin: form.values.vin.trim().toUpperCase(),
      year: Number(form.values.year) || new Date().getFullYear(),
      make: form.values.make.trim(),
      model: form.values.model.trim(),
      trim: form.values.trim.trim() || undefined,
      type: form.values.type as VehicleFormValues['type'] as never,
      mileage: Number(form.values.mileage) || 0,
      exteriorColor: form.values.exteriorColor.trim(),
      interiorColor: form.values.interiorColor.trim(),
      transmission: form.values.transmission as never,
      fuelType: form.values.fuelType as never,
      condition: form.values.condition as never,
      acquisitionCost: dollarsToCents(form.values.acquisitionCost || '0'),
      listPrice: dollarsToCents(form.values.listPrice),
      locationId: form.values.locationId,
      acquiredAt: form.values.acquiredAt,
      notes: form.values.notes.trim() || undefined,
    };

    if (vehicle) {
      dispatch({ type: 'vehicle/update', id: vehicle.id, patch: input });
      notify(`${vehicle.code} updated.`, 'success');
    } else {
      dispatch({ type: 'vehicle/create', input });
      notify('Vehicle added to inventory.', 'success');
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={vehicle ? `Edit ${vehicle.code}` : 'Add a vehicle'}
      description={
        vehicle ? vehicleTitle(vehicle) : 'New units arrive in stock and become available at once.'
      }
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {vehicle ? 'Save changes' : 'Add vehicle'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FormField label="Year" htmlFor="vehicle-year">
            <NumberInput
              id="vehicle-year"
              min="1950"
              max={String(new Date().getFullYear() + 2)}
              value={form.values.year}
              onChange={(value) => form.set('year', value)}
            />
          </FormField>

          <FormField label="Make" htmlFor="vehicle-make" error={form.errors.make}>
            <TextInput
              id="vehicle-make"
              value={form.values.make}
              invalid={Boolean(form.errors.make)}
              onChange={(event) => form.set('make', event.target.value)}
            />
          </FormField>

          <FormField label="Model" htmlFor="vehicle-model" error={form.errors.model}>
            <TextInput
              id="vehicle-model"
              value={form.values.model}
              invalid={Boolean(form.errors.model)}
              onChange={(event) => form.set('model', event.target.value)}
            />
          </FormField>

          <FormField label="Trim" htmlFor="vehicle-trim" optional>
            <TextInput
              id="vehicle-trim"
              value={form.values.trim}
              onChange={(event) => form.set('trim', event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="VIN" htmlFor="vehicle-vin" error={form.errors.vin}>
          <TextInput
            id="vehicle-vin"
            maxLength={17}
            className="font-mono uppercase"
            value={form.values.vin}
            invalid={Boolean(form.errors.vin)}
            onChange={(event) => form.set('vin', event.target.value)}
          />
        </FormField>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FormField label="Body type" htmlFor="vehicle-type">
            <Select
              id="vehicle-type"
              value={form.values.type}
              onChange={(event) => form.set('type', event.target.value)}
            >
              {VEHICLE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Condition" htmlFor="vehicle-condition">
            <Select
              id="vehicle-condition"
              value={form.values.condition}
              onChange={(event) => form.set('condition', event.target.value)}
            >
              {VEHICLE_CONDITIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Transmission" htmlFor="vehicle-transmission">
            <Select
              id="vehicle-transmission"
              value={form.values.transmission}
              onChange={(event) => form.set('transmission', event.target.value)}
            >
              {TRANSMISSIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Fuel" htmlFor="vehicle-fuel">
            <Select
              id="vehicle-fuel"
              value={form.values.fuelType}
              onChange={(event) => form.set('fuelType', event.target.value)}
            >
              {FUEL_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FormField label="Mileage" htmlFor="vehicle-mileage">
            <NumberInput
              id="vehicle-mileage"
              value={form.values.mileage}
              onChange={(value) => form.set('mileage', value)}
            />
          </FormField>

          <FormField label="Exterior" htmlFor="vehicle-exterior" optional>
            <TextInput
              id="vehicle-exterior"
              value={form.values.exteriorColor}
              onChange={(event) => form.set('exteriorColor', event.target.value)}
            />
          </FormField>

          <FormField label="Interior" htmlFor="vehicle-interior" optional>
            <TextInput
              id="vehicle-interior"
              value={form.values.interiorColor}
              onChange={(event) => form.set('interiorColor', event.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <FormField label="Acquisition cost" htmlFor="vehicle-cost" optional>
            <MoneyInput
              id="vehicle-cost"
              value={form.values.acquisitionCost}
              onChange={(value) => form.set('acquisitionCost', value)}
            />
          </FormField>

          <FormField label="List price" htmlFor="vehicle-price" error={form.errors.listPrice}>
            <MoneyInput
              id="vehicle-price"
              value={form.values.listPrice}
              invalid={Boolean(form.errors.listPrice)}
              onChange={(value) => form.set('listPrice', value)}
            />
          </FormField>

          <FormField label="Location" htmlFor="vehicle-location">
            <Select
              id="vehicle-location"
              value={form.values.locationId}
              onChange={(event) => form.set('locationId', event.target.value)}
            >
              {state.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Acquired" htmlFor="vehicle-acquired">
            <TextInput
              id="vehicle-acquired"
              type="date"
              value={form.values.acquiredAt}
              onChange={(event) => form.set('acquiredAt', event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Notes" htmlFor="vehicle-notes" optional>
          <TextArea
            id="vehicle-notes"
            rows={2}
            value={form.values.notes}
            onChange={(event) => form.set('notes', event.target.value)}
          />
        </FormField>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Dialog>
  );
}

/** Taking a unit off the market is a decision, so it is confirmed. */
export function MarkUnavailableDialog({
  open,
  onClose,
  vehicleId,
}: {
  open: boolean;
  onClose: () => void;
  vehicleId: string;
}) {
  const { state, dispatch, notify } = useDealer();
  const vehicle = getVehicle(state, vehicleId);

  return (
    <ConfirmDialog
      open={open}
      onCancel={onClose}
      onConfirm={() => {
        dispatch({ type: 'vehicle/status', id: vehicleId, status: 'Unavailable' });
        notify(`${vehicle?.code ?? 'Vehicle'} marked unavailable.`, 'success');
        onClose();
      }}
      title="Mark this vehicle unavailable?"
      confirmLabel="Mark unavailable"
      tone="danger"
      description={
        <>
          <p>
            {vehicle ? `${vehicle.code} — ${vehicleTitle(vehicle)}` : 'The vehicle'} will stop
            appearing as available and cannot be reserved or sold until it is put back in stock.
          </p>
          <p className="mt-2 text-muted">Existing reservations are not affected.</p>
        </>
      }
    />
  );
}
