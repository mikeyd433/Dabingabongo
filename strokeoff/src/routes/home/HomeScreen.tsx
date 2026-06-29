import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { DisplayNameForm } from '@/features/identity/DisplayNameForm'
import { signInAnonymously, useAuth } from '@/lib/auth'
import { useProfile } from '@/lib/profile'

/**
 * Home tab (spec §3). First run asks only for a display name to get playing
 * (anonymous sign-in). Once you have an identity, it becomes the start-a-round
 * invitation. Round creation itself lands in Phase 3.
 */
export function HomeScreen() {
  const { user, loading } = useAuth()

  if (loading) {
    return <CenterMessage>Getting you set up…</CenterMessage>
  }

  if (!user) {
    return <FirstRun />
  }

  return <SignedInHome />
}

function FirstRun() {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <h1 className="font-display text-2xl font-bold text-text">
        Welcome to Stroke<span className="text-accent"> Off</span>
      </h1>
      <p className="mt-2 max-w-sm font-label text-sm text-muted">
        A points-based side-game for your disc golf round. Pick a display name
        to start — you can sign in later to save your progress.
      </p>
      <div className="mt-6 w-full max-w-xs">
        <DisplayNameForm
          submitLabel="Let's play"
          onSubmit={(name) => signInAnonymously(name)}
        />
        <p className="mt-3 font-label text-xs text-muted">
          Want to save across devices? You can sign in from{' '}
          <Link to="/community" className="text-accent underline">
            Community
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

function SignedInHome() {
  const { data: profile } = useProfile()
  const navigate = useNavigate()
  const greeting = profile?.display_name ? `, ${profile.display_name}` : ''

  return (
    <EmptyState
      title={`Start your first round${greeting}`}
      message="Stroke Off rides alongside your regular round — log points when conditions are met, and they convert to stroke deductions at the end."
      action={
        <div className="flex flex-col items-center gap-3">
          <Button type="button" onClick={() => navigate('/round/new')}>
            Start a round
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/round')}
          >
            Join a round
          </Button>
        </div>
      }
    />
  )
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-label text-sm text-muted">{children}</p>
    </div>
  )
}
