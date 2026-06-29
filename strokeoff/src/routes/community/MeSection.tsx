import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/Button'
import { FormMessage } from '@/components/FormMessage'
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
import {
  CUSTOM_MESSAGE_MAX,
  errorMessage,
  validateCustomMessage,
} from '@/lib/validation'

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
      <AccountCard isAnonymous={isAnonymous} />
    </div>
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
      {!isAnonymous ? <AvatarRow /> : null}

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
            this device until you do). Avatars and a custom message unlock once
            you sign in.
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
    if (!file) return
    setError(null)
    uploadAvatar.mutate(file, {
      onError: (err) => setError(errorMessage(err)),
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
