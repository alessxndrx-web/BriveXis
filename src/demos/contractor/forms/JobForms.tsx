import { useMemo, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { Button, Checkbox, FormField, Select, TextArea, TextInput } from '../components/AppUI';
import { NumberInput, required, useForm, validAmount } from './formUtils';
import { useContractor } from '../ContractorProvider';
import {
  JOB_PRIORITIES,
  type Job,
  type JobPriority,
  type ChecklistItem,
} from '../contractor.types';
import {
  customerLocations,
  crewMembers,
  getCrew,
} from '../contractor.selectors';
import {
  addDays,
  formatAddressShort,
  fromDateTimeInput,
  toDateTimeInput,
} from '../contractor.utils';
import { track } from '../../../lib/analytics';

/**
 * The dialogs that move a job through its lifecycle: scheduling, crew
 * assignment, field reporting and completion.
 *
 * Drag-and-drop was deliberately not built for the schedule. A half-working
 * drag that cannot be operated from a keyboard would be worse than these
 * dialogs, which work identically with a mouse, a keyboard and a touch screen.
 */

// ------------------------------------------------------------- scheduling

interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  job: Job;
}

interface ScheduleValues {
  start: string;
  end: string;
  crewId: string;
}

export function ScheduleDialog({ open, onClose, job }: ScheduleDialogProps) {
  const { state, dispatch, notify } = useContractor();

  const initial = useMemo<ScheduleValues>(() => {
    // A job with no date is proposed for the next working morning rather than
    // presenting an empty field the visitor has to fill in from scratch.
    const suggestedStart = addDays(new Date(), 1);
    suggestedStart.setHours(8, 0, 0, 0);
    const suggestedEnd = new Date(suggestedStart);
    suggestedEnd.setHours(16, 0, 0, 0);

    return {
      start: toDateTimeInput(job.scheduledStart ?? suggestedStart.toISOString()),
      end: toDateTimeInput(job.scheduledEnd ?? suggestedEnd.toISOString()),
      crewId: job.crewId ?? '',
    };
  }, [job]);

  const form = useForm<ScheduleValues>(initial);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const key = `${job.id}:${job.scheduledStart ?? ''}`;
  if (open && seededFor !== key) {
    setSeededFor(key);
    form.reset(initial);
  }

  const submit = () => {
    const valid = form.validate((values) => {
      const errors: Record<string, string | undefined> = {
        start: required(values.start, 'Start'),
        end: required(values.end, 'End'),
      };
      if (values.start && values.end && new Date(values.end) < new Date(values.start)) {
        errors.end = 'End must be on or after the start.';
      }
      return errors as never;
    });
    if (!valid) return;

    dispatch({
      type: 'job/schedule',
      id: job.id,
      start: fromDateTimeInput(form.values.start),
      end: fromDateTimeInput(form.values.end),
    });

    if (form.values.crewId !== (job.crewId ?? '')) {
      dispatch({
        type: 'job/assignCrew',
        id: job.id,
        crewId: form.values.crewId || undefined,
      });
    }

    track('job_scheduled', { hadCrew: Boolean(form.values.crewId) });
    notify(`${job.code} scheduled.`, 'success');
    onClose();
  };

  const unschedule = () => {
    dispatch({ type: 'job/schedule', id: job.id, start: undefined, end: undefined });
    notify(`${job.code} returned to unscheduled.`);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={job.scheduledStart ? `Reschedule ${job.code}` : `Schedule ${job.code}`}
      description={job.title}
      footer={
        <>
          {job.scheduledStart && (
            <Button variant="ghost" onClick={unschedule} className="mr-auto">
              Unschedule
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Save schedule
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Start" htmlFor="start" error={form.errors.start}>
            <TextInput
              id="start"
              type="datetime-local"
              value={form.values.start}
              invalid={Boolean(form.errors.start)}
              onChange={(event) => form.set('start', event.target.value)}
            />
          </FormField>

          <FormField label="End" htmlFor="end" error={form.errors.end}>
            <TextInput
              id="end"
              type="datetime-local"
              value={form.values.end}
              invalid={Boolean(form.errors.end)}
              onChange={(event) => form.set('end', event.target.value)}
            />
          </FormField>
        </div>

        <FormField
          label="Crew"
          htmlFor="crewId"
          optional
          hint="Crews are matched to jobs by trade, but any crew can be assigned."
        >
          <Select
            id="crewId"
            value={form.values.crewId}
            onChange={(event) => form.set('crewId', event.target.value)}
          >
            <option value="">Unassigned</option>
            {state.crews.map((crew) => (
              <option key={crew.id} value={crew.id}>
                {crew.name} — {crew.trade}
              </option>
            ))}
          </Select>
        </FormField>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Dialog>
  );
}

// -------------------------------------------------------- crew assignment

export function AssignCrewDialog({
  open,
  onClose,
  job,
}: {
  open: boolean;
  onClose: () => void;
  job: Job;
}) {
  const { state, dispatch, notify } = useContractor();
  const [crewId, setCrewId] = useState(job.crewId ?? '');
  const [seededFor, setSeededFor] = useState<string | null>(null);

  if (open && seededFor !== job.id) {
    setSeededFor(job.id);
    setCrewId(job.crewId ?? '');
  }

  const submit = () => {
    dispatch({ type: 'job/assignCrew', id: job.id, crewId: crewId || undefined });
    const crew = getCrew(state, crewId);
    notify(crew ? `${crew.name} assigned to ${job.code}.` : `Crew removed from ${job.code}.`, 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Assign crew — ${job.code}`}
      description={job.title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Assign crew
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="sr-only">Select a crew</legend>
        <div className="space-y-2">
          {state.crews.map((crew) => {
            const members = crewMembers(state, crew.id);
            const selected = crewId === crew.id;
            return (
              <label
                key={crew.id}
                className={`flex items-start gap-3 border rounded-[3px] px-3 py-2.5 cursor-pointer transition-colors ${
                  selected
                    ? 'border-copper bg-copper/[0.05]'
                    : 'border-app-border hover:bg-app-hover'
                }`}
              >
                <input
                  type="radio"
                  name="crew"
                  value={crew.id}
                  checked={selected}
                  onChange={() => setCrewId(crew.id)}
                  className="mt-1 accent-[#B96E3B]"
                />
                <span className="min-w-0">
                  <span className="block text-[0.875rem] font-medium text-charcoal">
                    {crew.name}
                  </span>
                  <span className="block text-[0.75rem] text-muted">
                    {crew.trade} · {members.length} members ·{' '}
                    {members.map((member) => member.name).join(', ')}
                  </span>
                </span>
              </label>
            );
          })}

          <label
            className={`flex items-center gap-3 border rounded-[3px] px-3 py-2.5 cursor-pointer transition-colors ${
              crewId === '' ? 'border-copper bg-copper/[0.05]' : 'border-app-border hover:bg-app-hover'
            }`}
          >
            <input
              type="radio"
              name="crew"
              value=""
              checked={crewId === ''}
              onChange={() => setCrewId('')}
              className="accent-[#B96E3B]"
            />
            <span className="text-[0.875rem] text-charcoal">Leave unassigned</span>
          </label>
        </div>
      </fieldset>
    </Dialog>
  );
}

// ------------------------------------------------------------ field record

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { label: 'Site protection in place', done: false },
  { label: 'Work performed as scoped', done: false },
  { label: 'Materials logged', done: false },
  { label: 'Site cleaned', done: false },
];

interface FieldRecordValues {
  occurredAt: string;
  memberId: string;
  workPerformed: string;
  statusUpdate: string;
  hours: string;
  materialsUsed: string;
  notes: string;
}

export function FieldRecordForm({
  open,
  onClose,
  job,
}: {
  open: boolean;
  onClose: () => void;
  job: Job;
}) {
  const { state, dispatch, notify } = useContractor();
  const members = job.crewId ? crewMembers(state, job.crewId) : [];

  const initial = useMemo<FieldRecordValues>(
    () => ({
      occurredAt: toDateTimeInput(new Date().toISOString()),
      memberId: members[0]?.id ?? '',
      workPerformed: '',
      statusUpdate: '',
      hours: '8',
      materialsUsed: '',
      notes: '',
    }),
    // Keyed on the job rather than on `members`, which is rebuilt every render.
    [job.id, job.crewId],
  );

  const form = useForm<FieldRecordValues>(initial);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  if (open && seededFor !== job.id) {
    setSeededFor(job.id);
    form.reset(initial);
    setChecklist(DEFAULT_CHECKLIST.map((item) => ({ ...item })));
  }

  const submit = () => {
    const valid = form.validate((values) => ({
      workPerformed: required(values.workPerformed, 'Work performed'),
      occurredAt: required(values.occurredAt, 'Date and time'),
      hours: validAmount(values.hours, 'Hours'),
    }));
    if (!valid) return;

    dispatch({
      type: 'field/add',
      input: {
        jobId: job.id,
        crewId: job.crewId,
        memberId: form.values.memberId || undefined,
        occurredAt: fromDateTimeInput(form.values.occurredAt) ?? new Date().toISOString(),
        workPerformed: form.values.workPerformed.trim(),
        statusUpdate: form.values.statusUpdate.trim(),
        notes: form.values.notes.trim(),
        hours: Number(form.values.hours) || 0,
        materialsUsed: form.values.materialsUsed.trim(),
        checklist,
      },
    });

    track('field_record_added');
    notify('Field record added.', 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add field record — ${job.code}`}
      description="Log what happened on site. Adding a record starts a scheduled job."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Save record
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Date and time" htmlFor="occurredAt" error={form.errors.occurredAt}>
            <TextInput
              id="occurredAt"
              type="datetime-local"
              value={form.values.occurredAt}
              invalid={Boolean(form.errors.occurredAt)}
              onChange={(event) => form.set('occurredAt', event.target.value)}
            />
          </FormField>

          <FormField label="Crew member" htmlFor="memberId" optional>
            <Select
              id="memberId"
              value={form.values.memberId}
              onChange={(event) => form.set('memberId', event.target.value)}
            >
              <option value="">Not specified</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} — {member.role}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Hours" htmlFor="hours" error={form.errors.hours}>
            <NumberInput
              id="hours"
              step="0.5"
              value={form.values.hours}
              onChange={(value) => form.set('hours', value)}
            />
          </FormField>
        </div>

        <FormField label="Work performed" htmlFor="workPerformed" error={form.errors.workPerformed}>
          <TextArea
            id="workPerformed"
            rows={3}
            value={form.values.workPerformed}
            invalid={Boolean(form.errors.workPerformed)}
            placeholder="What the crew actually did today."
            onChange={(event) => form.set('workPerformed', event.target.value)}
          />
        </FormField>

        <FormField
          label="Status update"
          htmlFor="statusUpdate"
          optional
          hint="One line the office can read at a glance."
        >
          <TextInput
            id="statusUpdate"
            value={form.values.statusUpdate}
            placeholder="e.g. Tear-off complete, dry-in tomorrow"
            onChange={(event) => form.set('statusUpdate', event.target.value)}
          />
        </FormField>

        <FormField label="Materials used" htmlFor="materialsUsed" optional>
          <TextInput
            id="materialsUsed"
            value={form.values.materialsUsed}
            placeholder="e.g. 14 squares of shingles, 2 sheets OSB"
            onChange={(event) => form.set('materialsUsed', event.target.value)}
          />
        </FormField>

        <fieldset className="border-t border-app-border pt-3">
          <legend className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-2">
            Completion checklist
          </legend>
          <div className="space-y-2">
            {checklist.map((item, index) => (
              <Checkbox
                key={item.label}
                id={`checklist-${index}`}
                label={item.label}
                checked={item.done}
                onChange={() =>
                  setChecklist((current) =>
                    current.map((entry, position) =>
                      position === index ? { ...entry, done: !entry.done } : entry,
                    ),
                  )
                }
              />
            ))}
          </div>
        </fieldset>

        <FormField label="Notes" htmlFor="notes" optional>
          <TextArea
            id="notes"
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

// ------------------------------------------------------------- completion

export function CompleteJobDialog({
  open,
  onClose,
  job,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  job: Job;
  onCompleted?: () => void;
}) {
  const { dispatch, notify } = useContractor();
  const [completedAt, setCompletedAt] = useState(toDateTimeInput(new Date().toISOString()));
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string>();
  const [seededFor, setSeededFor] = useState<string | null>(null);

  if (open && seededFor !== job.id) {
    setSeededFor(job.id);
    setCompletedAt(toDateTimeInput(new Date().toISOString()));
    setNotes('');
    setConfirmed(false);
    setError(undefined);
  }

  const submit = () => {
    // Completion is what makes a job billable, so it takes an explicit
    // confirmation rather than a single click that could be a misclick.
    if (!confirmed) {
      setError('Please confirm the work is finished.');
      document.getElementById('completion-confirm')?.focus();
      return;
    }

    dispatch({
      type: 'job/complete',
      id: job.id,
      completedAt: fromDateTimeInput(completedAt) ?? new Date().toISOString(),
      notes: notes.trim(),
    });
    track('job_completed');
    notify(`${job.code} marked complete.`, 'success');
    onClose();
    onCompleted?.();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Complete ${job.code}`}
      description="Confirm the work is finished. You can create an invoice straight afterwards."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Mark complete
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
        <FormField label="Completed on" htmlFor="completedAt">
          <TextInput
            id="completedAt"
            type="datetime-local"
            value={completedAt}
            onChange={(event) => setCompletedAt(event.target.value)}
            className="sm:max-w-[16rem]"
          />
        </FormField>

        <FormField label="Completion notes" htmlFor="completionNotes" optional>
          <TextArea
            id="completionNotes"
            rows={3}
            value={notes}
            placeholder="Final walkthrough, customer sign-off, anything left outstanding."
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>

        <div className="border-t border-app-border pt-3">
          <Checkbox
            id="completion-confirm"
            label="The scoped work is finished and the site has been left ready for the customer."
            checked={confirmed}
            onChange={(event) => {
              setConfirmed(event.target.checked);
              setError(undefined);
            }}
          />
          {error && (
            <p role="alert" className="mt-2 text-[0.75rem] text-danger">
              {error}
            </p>
          )}
        </div>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Complete
        </button>
      </form>
    </Dialog>
  );
}

// ------------------------------------------------------------- job create

interface JobFormValues {
  customerId: string;
  locationId: string;
  title: string;
  scope: string;
  priority: JobPriority;
  notes: string;
}

export function JobForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch, notify } = useContractor();

  const initial: JobFormValues = {
    customerId: '',
    locationId: '',
    title: '',
    scope: '',
    priority: 'Normal',
    notes: '',
  };

  const form = useForm<JobFormValues>(initial);
  const [seeded, setSeeded] = useState(false);
  if (open && !seeded) {
    setSeeded(true);
    form.reset(initial);
  }
  if (!open && seeded) setSeeded(false);

  const locations = form.values.customerId
    ? customerLocations(state, form.values.customerId)
    : [];

  const submit = () => {
    const valid = form.validate((values) => ({
      customerId: required(values.customerId, 'Customer'),
      locationId: required(values.locationId, 'Service location'),
      title: required(values.title, 'Job title'),
    }));
    if (!valid) return;

    dispatch({
      type: 'job/create',
      input: {
        customerId: form.values.customerId,
        locationId: form.values.locationId,
        title: form.values.title.trim(),
        scope: form.values.scope.trim(),
        priority: form.values.priority,
        notes: form.values.notes.trim(),
      },
    });
    track('job_created', { fromEstimate: false });
    notify('Job created.', 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New job"
      description="Jobs created directly start unscheduled. Most jobs come from an accepted estimate instead."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Create job
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Customer" htmlFor="customerId" error={form.errors.customerId}>
            <Select
              id="customerId"
              value={form.values.customerId}
              invalid={Boolean(form.errors.customerId)}
              onChange={(event) => {
                form.set('customerId', event.target.value);
                form.set('locationId', '');
              }}
            >
              <option value="">Select a customer</option>
              {state.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Service location"
            htmlFor="locationId"
            error={form.errors.locationId}
            hint={!form.values.customerId ? 'Choose a customer first.' : undefined}
          >
            <Select
              id="locationId"
              value={form.values.locationId}
              disabled={!form.values.customerId}
              invalid={Boolean(form.errors.locationId)}
              onChange={(event) => form.set('locationId', event.target.value)}
            >
              <option value="">Select a location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label} — {formatAddressShort(location.address)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Job title" htmlFor="title" error={form.errors.title}>
          <TextInput
            id="title"
            value={form.values.title}
            invalid={Boolean(form.errors.title)}
            onChange={(event) => form.set('title', event.target.value)}
          />
        </FormField>

        <FormField label="Priority" htmlFor="priority">
          <Select
            id="priority"
            value={form.values.priority}
            onChange={(event) => form.set('priority', event.target.value as JobPriority)}
            className="sm:max-w-[12rem]"
          >
            {JOB_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Scope of work" htmlFor="scope" optional>
          <TextArea
            id="scope"
            rows={3}
            value={form.values.scope}
            onChange={(event) => form.set('scope', event.target.value)}
          />
        </FormField>

        <FormField label="Notes" htmlFor="notes" optional>
          <TextArea
            id="notes"
            rows={2}
            value={form.values.notes}
            placeholder="Access, parking, on-site contact…"
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
