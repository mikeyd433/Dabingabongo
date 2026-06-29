import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { EmptyState } from '@/components/EmptyState'
import { FormMessage } from '@/components/FormMessage'
import { sendMagicLink, useAuth } from '@/lib/auth'
import { useCurrentRound, useJoinRound } from '@/lib/rounds'
import { useRedeemClaim } from '@/lib/claim'
import { errorMessage } from '@/lib/validation'

/**
 * Round tab index (spec §3). Routes you into your live round, handles a join code
 * (from a QR link or manual entry) or a guest claim link (`?claim=…`, spec §10),
 * or offers start/join when nothing is active.
 */
export function RoundScreen() {
  const { user, loading } = useAuth()
  const [searchParams] = useSearchParams()
  const joinCode = searchParams.get('join')
  const claimToken = searchParams.get('claim')

  if (loading) return <Centered>Loading…</Centered>

  // Claim comes first and tolerates a signed-out visitor (the guest from the email).
  if (claimToken) return <ClaimHandler token={claimToken} />

  if (!user) {
    return (
      <EmptyState
        title="No round in play"
        message="Pick a display name on Home, then start or join a round."
      />
    )
  }

  if (joinCode) return <JoinHandler code={joinCode} />

  return <RoundEntry />
}

/**
 * Lands a `?claim=TOKEN` link (spec §10). A signed-out guest signs in via
 * magic-link first (returning to this same URL); once signed in, the token is
 * redeemed and their guest slot + points move to their account.
 */
function ClaimHandler({ token }: { token: string }) {
  const { user, loading } = useAuth()
  const redeem = useRedeemClaim()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const attempted = useRef(false)

  useEffect(() => {
    if (loading || !user || attempted.current) return
    attempted.current = true
    redeem
      .mutateAsync(token)
      .then((round) => navigate(`/round/${round.id}`, { replace: true }))
      .catch((e) => setError(errorMessage(e)))
  }, [user, loading, token, redeem, navigate])

  if (loading) return <Centered>Loading…</Centered>
  if (!user) return <ClaimSignIn />
  if (error) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <FormMessage tone="error">{error}</FormMessage>
        <Button type="button" onClick={() => navigate('/', { replace: true })}>
          Back to Home
        </Button>
      </div>
    )
  }
  return <Centered>Claiming your score…</Centered>
}

function ClaimSignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSend() {
    if (!email.includes('@')) {
      setError('Enter your email.')
      return
    }
    setPending(true)
    setError(null)
    try {
      // Return to this exact claim URL after the magic link so the claim resumes.
      await sendMagicLink(email.trim(), window.location.href)
      setSent(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  if (sent) {
    return (
      <div className="p-4">
        <EmptyState
          title="Check your email"
          message="Tap the link we sent to sign in and claim your score."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <EmptyState
        title="Claim your score"
        message="Sign in with your email to keep this round's score on your own account."
      />
      <div className="flex gap-2">
        <TextInput
          type="email"
          inputMode="email"
          value={email}
          placeholder="you@email.com"
          aria-label="Your email"
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="button" disabled={pending} onClick={handleSend}>
          {pending ? 'Sending…' : 'Send link'}
        </Button>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  )
}

function RoundEntry() {
  const { data: currentRound, isLoading } = useCurrentRound()
  const navigate = useNavigate()

  if (isLoading) return <Centered>Checking for a live round…</Centered>
  if (currentRound) {
    return <Navigate to={`/round/${currentRound.id}`} replace />
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <EmptyState
        title="No round in play"
        message="Start a new round, or join one with a QR code or round code."
        action={
          <Button type="button" onClick={() => navigate('/round/new')}>
            Start a round
          </Button>
        }
      />
      <JoinForm />
    </div>
  )
}

function JoinForm() {
  const joinRound = useJoinRound()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleJoin() {
    if (code.trim().length === 0) {
      setError('Enter a round code.')
      return
    }
    setError(null)
    try {
      const round = await joinRound.mutateAsync(code.trim())
      navigate(`/round/${round.id}`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">
        Join a round
      </h2>
      <p className="mt-1 font-label text-xs text-muted">
        Enter a round code, or scan a QR code from the host's lobby.
      </p>
      <div className="mt-2 flex gap-2">
        <TextInput
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Round code"
          autoCapitalize="characters"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={handleJoin}
          disabled={joinRound.isPending}
        >
          {joinRound.isPending ? 'Joining…' : 'Join'}
        </Button>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </section>
  )
}

/** Auto-joins from a `?join=CODE` link (QR fast path) then routes to the lobby. */
function JoinHandler({ code }: { code: string }) {
  const joinRound = useJoinRound()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true
    joinRound
      .mutateAsync(code)
      .then((round) => navigate(`/round/${round.id}`, { replace: true }))
      .catch((err) => setError(errorMessage(err)))
  }, [code, joinRound, navigate])

  if (error) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <FormMessage tone="error">{error}</FormMessage>
        <Button
          type="button"
          onClick={() => navigate('/round', { replace: true })}
        >
          Back to Round
        </Button>
      </div>
    )
  }

  return <Centered>Joining round {code}…</Centered>
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center font-label text-sm text-muted">
      {children}
    </div>
  )
}
