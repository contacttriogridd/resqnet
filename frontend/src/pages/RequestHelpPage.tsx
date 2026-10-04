import { zodResolver } from '@hookform/resolvers/zod';
import {
  INCIDENT_TYPES,
  INCIDENT_TYPE_LABELS,
  PEOPLE_COUNTS,
  PEOPLE_COUNT_LABELS,
  SEVERITIES,
  SEVERITY_HINTS,
  SEVERITY_LABELS,
  SPECIAL_REQUIREMENTS,
  SPECIAL_REQUIREMENT_LABELS,
  incidentCreateSchema,
  type IncidentType,
} from '@resqnet/shared';
import { Save, Send } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import type { z } from 'zod';
import { LocationField } from '../components/LocationField';
import { Button, Card, Choice, FieldError, Label, Notice, PageHeader, TextArea, TextInput } from '../components/ui';
import { META, getMeta } from '../database/db';
import { useNetwork } from '../hooks/useStore';
import { errorMessage } from '../services/apiClient';
import { getDraft, saveDraft, submitIncident } from '../services/incidentService';
import type { MyEmergencyInfo } from '../types/local';

const formSchema = incidentCreateSchema.omit({ clientId: true, deviceId: true, clientCreatedAt: true });
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

const EMPTY: Partial<FormInput> = {
  peopleCount: 'ONE',
  specialRequirements: [],
  location: { source: 'MANUAL' },
  description: '',
  contactPhone: '',
};

/**
 * Full emergency request form — intentionally short. Works identically
 * offline: submission writes to IndexedDB first, then syncs.
 */
export function RequestHelpPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const net = useNetwork();
  const isReport = params.get('mode') === 'report';
  const presetType = params.get('type') as IncidentType | null;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const loaded = useRef(false);
  const ids = { desc: useId(), phone: useId() };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...EMPTY, ...(presetType && INCIDENT_TYPES.includes(presetType) ? { type: presetType } : {}) },
  });

  // Restore an unsent draft (e.g. the app was closed mid-way), and prefill phone.
  useEffect(() => {
    void (async () => {
      const [draft, myInfo] = await Promise.all([getDraft<FormInput>(), getMeta<MyEmergencyInfo>(META.myInfo)]);
      const phone = myInfo?.sharePhoneWithRequests && myInfo.phone ? myInfo.phone : '';
      if (draft && !presetType) {
        reset({ ...EMPTY, ...draft });
        setDraftRestored(true);
      } else if (phone) {
        reset((v) => ({ ...v, contactPhone: phone }));
      }
      loaded.current = true;
    })();
  }, [reset, presetType]);

  // Autosave the draft to the device while typing.
  const values = useWatch({ control });
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => void saveDraft(values), 600);
    return () => clearTimeout(t);
  }, [values]);

  const onSubmit = async (data: FormOutput) => {
    setSubmitError(null);
    try {
      const local = await submitIncident(data);
      navigate(`/reports/${local.clientId}?new=1`, { replace: true });
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        back="/"
        title={isReport ? 'Report an emergency' : 'Request help'}
        subtitle={
          isReport
            ? 'Tell responders about an emergency you can see — for you or for others.'
            : 'Only a few questions. You can send this even without internet.'
        }
      />

      {net.state === 'offline' && (
        <Notice tone="warning" className="mb-4" title="You are offline — you can still submit.">
          Your request will be saved on this device and sent automatically when the connection returns.
        </Notice>
      )}
      {draftRestored && (
        <Notice tone="info" icon={Save} className="mb-4">
          We restored the request you started earlier.{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              reset(EMPTY);
              setDraftRestored(false);
            }}
          >
            Start over
          </button>
        </Notice>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Card>
          <fieldset aria-describedby={errors.type ? 'err-type' : undefined}>
            <legend className="mb-2 text-lg font-bold">Type of emergency</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {INCIDENT_TYPES.map((t) => (
                <Choice key={t} value={t} label={INCIDENT_TYPE_LABELS[t]} {...register('type')} />
              ))}
            </div>
            <FieldError id="err-type">{errors.type && 'Choose the type of emergency'}</FieldError>
          </fieldset>
        </Card>

        <Card>
          <fieldset aria-describedby={errors.severity ? 'err-sev' : undefined}>
            <legend className="mb-2 text-lg font-bold">How serious is it?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SEVERITIES.map((s) => (
                <Choice key={s} value={s} label={SEVERITY_LABELS[s]} hint={SEVERITY_HINTS[s]} {...register('severity')} />
              ))}
            </div>
            <FieldError id="err-sev">{errors.severity && 'Choose how serious it is'}</FieldError>
          </fieldset>
        </Card>

        <Card>
          <fieldset>
            <legend className="mb-2 text-lg font-bold">Number of people</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PEOPLE_COUNTS.map((p) => (
                <Choice key={p} value={p} label={<span className="tabular">{PEOPLE_COUNT_LABELS[p]}</span>} {...register('peopleCount')} />
              ))}
            </div>
          </fieldset>
        </Card>

        <Card>
          <fieldset>
            <legend className="mb-2 text-lg font-bold">
              Special requirements <span className="font-normal text-muted">(tick all that apply)</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SPECIAL_REQUIREMENTS.map((r) => (
                <Choice
                  key={r}
                  type="checkbox"
                  value={r}
                  label={SPECIAL_REQUIREMENT_LABELS[r]}
                  {...register('specialRequirements')}
                />
              ))}
            </div>
          </fieldset>
        </Card>

        <Card>
          <Controller
            control={control}
            name="location"
            render={({ field }) => (
              <LocationField
                value={field.value as never}
                onChange={field.onChange}
                autoLocate
                error={
                  errors.location
                    ? (errors.location as { text?: { message?: string }; message?: string }).text?.message ??
                      errors.location.message ??
                      'Add your location'
                    : undefined
                }
              />
            )}
          />
        </Card>

        <Card className="space-y-4">
          <div>
            <Label htmlFor={ids.desc} hint="Optional. Anything rescuers should know.">
              Additional message
            </Label>
            <TextArea
              id={ids.desc}
              maxLength={500}
              rows={3}
              placeholder="e.g. Water is at waist level. Grandmother cannot walk."
              {...register('description')}
            />
            <FieldError>{errors.description?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor={ids.phone} hint="Optional. Lets responders call you back.">
              Phone number
            </Label>
            <TextInput id={ids.phone} type="tel" inputMode="tel" autoComplete="tel" {...register('contactPhone')} />
            <FieldError>{errors.contactPhone?.message}</FieldError>
          </div>
        </Card>

        {submitError && <Notice tone="critical" role="alert" title={submitError} />}

        <Button type="submit" variant="emergency" size="xl" block icon={Send} loading={isSubmitting}>
          {isReport ? 'Send report' : 'Send request for help'}
        </Button>
        <p className="text-center text-sm text-muted">
          If life is in immediate danger, also call <a href="tel:112" className="font-bold text-critical underline">112</a>.
        </p>
      </form>
    </div>
  );
}
