import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/Button'
import { FormMessage } from '@/components/FormMessage'
import { Select } from '@/components/Select'
import { DisplayNameForm } from '@/features/identity/DisplayNameForm'
import { EmailForm } from '@/features/identity/EmailForm'
import {
  deleteAccount,
  sendMagicLink,
  setEmail,
  signInAnonymously,
  signOut,
  useAuth,
} from '@/lib/auth'
import { useProfile, useUpdateProfile, useUploadAvatar } from '@/lib/profile'
import { haptic, hapticsEnabled, setHapticsEnabled } from '@/lib/haptics'
import { getRoundDefaults, setRoundDefaults } from '@/lib/preferences'
import { themes } from '@/themes'
import {
  CUSTOM_MESSAGE_MAX,
  errorMessage,
  validateCustomMessage,
} from '@/lib/validation'
import type { ScoringMode } from '@/types'

/** Community → Me (spec §11): identity, profile, and account management. */
export function MeSection() {
  const { user, isAnonymous, loading } = useAuth()

  if (loading) {
    return <Card title="Me">{<Muted>Loading your profile…</Muted>}</Card>
  }

  if (!user) {
    return <SignedOut />
  }

  return (
    <div className="flex flex-col gap-4">
      <ProfileCard isAnonymous={isAnonymous} />
      <SettingsCard />
      <ShareAppCard />
      <AccountCard isAnonymous={isAnonymous} />
    </div>
  )
}

/* ----------------------------------------------------------------- settings */

/** Me → Settings (spec §11): device + new-round defaults. */
function SettingsCard() {
  const [haptics, setHaptics] = useState(hapticsEnabled)
  const [defaults, setDefaults] = useState(getRoundDefaults)

  function update(next: Parameters<typeof setRoundDefaults>[0]) {
    setDefaults(setRoundDefaults(next))
  }

  return (
    <Card title="Settings">
      <ToggleRow
        label="Haptic feedback"
        hint="A short buzz on key taps (where your device supports it)."
        checked={haptics}
        onChange={(next) => {
          setHapticsEnabled(next)
          setHaptics(next)
          if (next) haptic('success')
        }}
      />

      <hr className="my-4 border-border" />

      <p className="font-label text-sm font-medium text-text">New round defaults</p>
      <Muted>Starting points when you set up a round — change them per round any time.</Muted>

      <div className="mt-3 flex flex-col gap-3">
        <label className="flex items-center justify-between gap-3">
          <span className="font-label text-sm text-text">Scoring mode</span>
          <div className="w-40">
            <Select
              value={defaults.scoringMode}
              onChange={(e) =>
                update({ scoringMode: e.target.value as ScoringMode })
              }
            >
              <option value="multi_phone">Multi phone</option>
              <option value="single_phone">Single phone</option>
            </Select>
          </div>
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="font-label text-sm text-text">Preferred theme</span>
          <div className="w-40">
            <Select
              value={defaults.themeId}
              onChange={(e) => update({ themeId: e.target.value })}
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </label>

        <ToggleRow
          label="Animations on by default"
          checked={defaults.animations}
          onChange={(next) => update({ animations: next })}
        />
      </div>
    </Card>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="font-label text-sm text-text">{label}</span>
        {hint ? (
          <span className="mt-0.5 block font-label text-xs text-muted">
            {hint}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-6 w-6 shrink-0 accent-[var(--color-accent)]"
      />
    </label>
  )
}

/* -------------------------------------------------------------- share / get */

/** A QR + link that takes anyone straight to the installable app (spec §16). */
function ShareAppCard() {
  const appUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL}`
      : ''
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current)
    },
    [],
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(appUrl)
      setCopied(true)
      haptic('light')
      if (resetTimer.current) window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked — the link is shown below to copy by hand.
    }
  }

  return (
    <Card title="Share Stroke Off">
      <Muted>
        Point a phone camera at this code to open the app — then add it to the
        home screen to install.
      </Muted>
      <div className="mt-3 flex flex-col items-center gap-3">
        <div className="rounded-card bg-white p-3">
          <QRCodeSVG value={appUrl} size={160} />
        </div>
        <p className="break-all text-center font-label text-xs text-muted">
          {appUrl}
        </p>
        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
    </Card>
  )
}

/* ---------------------------------------------------------------- signed out */

function SignedOut() {
  return (
    <Card title="Me">
      <Muted>
        Pick a display name to start playing right away. Sign in later to save
        your profile and rounds across devices — login is never required.
      </Muted>
      <div className="mt-4">
        <DisplayNameForm
          submitLabel="Start playing"
          onSubmit={(name) => signInAnonymously(name)}
        />
      </div>
      <hr className="my-4 border-border" />
      <p className="font-label text-sm font-medium text-text">
        Already have an account?
      </p>
      <div className="mt-2">
        <EmailForm
          label="Sign in with a magic link"
          submitLabel="Email me a link"
          successMessage="Check your email for a sign-in link."
          onSubmit={(email) => sendMagicLink(email)}
        />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ profile */

function ProfileCard({ isAnonymous }: { isAnonymous: boolean }) {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [savedName, setSavedName] = useState(false)

  return (
    <Card title="Profile">
      <AvatarRow />

      <div className="mt-2">
        <DisplayNameForm
          key={profile?.display_name ?? 'name'}
          initial={profile?.display_name ?? ''}
          submitLabel="Save name"
          onSubmit={async (name) => {
            await updateProfile.mutateAsync({ display_name: name })
            setSavedName(true)
          }}
        />
        {savedName ? <FormMessage tone="success">Saved.</FormMessage> : null}
      </div>

      <hr className="my-4 border-border" />

      {isAnonymous ? (
        <>
          <p className="font-label text-sm font-medium text-text">
            Save your progress
          </p>
          <Muted>
            Add your email to turn this into a permanent account (it stays on
            this device until you do). A custom message unlocks once you sign
            in.
          </Muted>
          <div className="mt-2">
            <EmailForm
              label="Email"
              submitLabel="Save my account"
              successMessage="Check your email to confirm and finish saving."
              onSubmit={(email) => setEmail(email)}
            />
          </div>
        </>
      ) : (
        <CustomMessageEditor initial={profile?.custom_message ?? ''} />
      )}
    </Card>
  )
}

function AvatarRow() {
  const { data: profile } = useProfile()
  const uploadAvatar = useUploadAvatar()
  const [error, setError] = useState<string | null>(null)

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const input = e.target
    if (!file) return
    setError(null)
    uploadAvatar.mutate(file, {
      onError: (err) => setError(errorMessage(err)),
      // Clear the input so picking the *same* file again (e.g. retry after a
      // failure) still fires a change event.
      onSettled: () => {
        input.value = ''
      },
    })
  }

  return (
    <div className="mb-2 flex items-center gap-4">
      <div
        className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface-alt font-display text-xl text-muted"
        aria-hidden={Boolean(profile?.avatar_url)}
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Your avatar"
            className="h-full w-full object-cover"
          />
        ) : (
          (profile?.display_name?.[0]?.toUpperCase() ?? '?')
        )}
      </div>
      <div>
        <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-card border border-border bg-surface px-4 font-label text-sm font-semibold text-text">
          {uploadAvatar.isPending ? 'Uploading…' : 'Change avatar'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFile}
            disabled={uploadAvatar.isPending}
          />
        </label>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      </div>
    </div>
  )
}

function CustomMessageEditor({ initial }: { initial: string }) {
  const updateProfile = useUpdateProfile()
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    const validationError = validateCustomMessage(value)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    try {
      await updateProfile.mutateAsync({ custom_message: value })
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="font-label text-sm text-text" htmlFor="custom-message">
        Custom message
      </label>
      <textarea
        id="custom-message"
        value={value}
        maxLength={CUSTOM_MESSAGE_MAX}
        onChange={(e) => {
          setValue(e.target.value)
          setSaved(false)
        }}
        placeholder="A short blurb others see next to your name."
        className="min-h-[72px] w-full rounded-card border border-border bg-surface px-3 py-2 font-label text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <span className="font-label text-xs text-muted">
        {value.length}/{CUSTOM_MESSAGE_MAX}
      </span>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button
        type="button"
        variant="secondary"
        onClick={save}
        disabled={updateProfile.isPending}
      >
        {updateProfile.isPending ? 'Saving…' : 'Save message'}
      </Button>
      {saved ? <FormMessage tone="success">Saved.</FormMessage> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ account */

function AccountCard({ isAnonymous }: { isAnonymous: boolean }) {
  return (
    <Card title="Account">
      {!isAnonymous ? (
        <>
          <EmailForm
            label="Change email"
            submitLabel="Update email"
            successMessage="Check both inboxes to confirm the change."
            onSubmit={(email) => setEmail(email)}
          />
          <hr className="my-4 border-border" />
        </>
      ) : null}

      <Button type="button" variant="secondary" onClick={() => void signOut()}>
        Sign out
      </Button>

      <hr className="my-4 border-border" />
      <DeleteAccount />
    </Card>
  )
}

function DeleteAccount() {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setPending(true)
    setError(null)
    try {
      await deleteAccount()
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-label text-sm font-medium text-text">Delete account</p>
      <Muted>
        Permanently erases your profile, avatar, and personal group. This can't
        be undone.
      </Muted>
      {confirming ? (
        <div className="flex flex-col gap-2">
          <FormMessage tone="error">
            Delete your account and all its data?
          </FormMessage>
          <div className="flex gap-2">
            <Button type="button" onClick={handleDelete} disabled={pending}>
              {pending ? 'Deleting…' : 'Yes, delete everything'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setConfirming(true)}
        >
          Delete account
        </Button>
      )}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  )
}

/* ------------------------------------------------------------------- shared */

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-display text-base font-semibold text-text">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="font-label text-sm text-muted">{children}</p>
}
