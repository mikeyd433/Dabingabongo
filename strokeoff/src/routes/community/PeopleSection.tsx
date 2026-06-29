import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { useAuth } from '@/lib/auth'
import { usePeople } from '@/lib/people'
import { personSubtitle } from '@/features/people/people'

/**
 * Community → People (Option B; spec §11). The players you've actually shared a
 * round with — no global directory. Tap a player to see their profile, their
 * visible rounds, and quick-add them to a group.
 */
export function PeopleSection() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: people = [], isLoading } = usePeople()

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-display text-base font-semibold text-text">People</h2>

      {!user ? (
        <p className="mt-2 font-label text-sm text-muted">
          People you've played with appear here after a shared round — no global
          directory, just your crew.
        </p>
      ) : isLoading ? (
        <p className="mt-2 font-label text-sm text-muted">Loading people…</p>
      ) : people.length === 0 ? (
        <p className="mt-2 font-label text-sm text-muted">
          People you've played with appear here after a shared round — no global
          directory, just your crew.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {people.map((person) => (
            <li key={person.profile_id}>
              <button
                type="button"
                onClick={() =>
                  navigate(`/community/people/${person.profile_id}`)
                }
                className="flex w-full items-center gap-3 rounded-card border border-border bg-surface-alt p-3 text-left hover:opacity-90"
              >
                <Avatar
                  name={person.display_name}
                  url={person.avatar_url}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-label text-sm font-semibold text-text">
                    {person.display_name}
                  </span>
                  <span className="block truncate font-label text-xs text-muted">
                    {personSubtitle(person)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
