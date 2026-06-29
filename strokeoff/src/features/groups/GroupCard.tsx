import { useState } from 'react'
import { Button } from '@/components/Button'
import { FormMessage } from '@/components/FormMessage'
import { ConversionEditor } from '@/features/conversion/ConversionEditor'
import { errorMessage } from '@/lib/validation'
import { useCreateInvite, useGroupMembers, useLeaveGroup } from '@/lib/groups'
import { useGroupConversion } from '@/lib/conversion'
import type { Group } from '@/types'

/** A group with inline management: invite, members, conversion, leave (spec §11). */
export function GroupCard({
  group,
  currentUserId,
}: {
  group: Group
  currentUserId: string
}) {
  const [open, setOpen] = useState(false)
  const isOwner = group.owner_id === currentUserId

  return (
    <li className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-label text-sm font-semibold text-text">
            {group.name}
          </span>
          <div className="mt-0.5 flex gap-2">
            {group.is_personal ? <Badge>Personal</Badge> : null}
            <Badge>{isOwner ? 'Owner' : 'Member'}</Badge>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide' : 'Manage'}
        </Button>
      </div>

      {open ? (
        <div className="mt-4 flex flex-col gap-5">
          <InviteRow groupId={group.id} />
          <Members groupId={group.id} />
          <ConversionRow conversionId={group.default_conversion_id} />
          {!group.is_personal && !isOwner ? (
            <LeaveRow groupId={group.id} />
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function InviteRow({ groupId }: { groupId: string }) {
  const createInvite = useCreateInvite()
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const link =
    code && typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL}?join=${code}`
      : null

  return (
    <section>
      <h3 className="font-label text-sm font-semibold text-text">Invite</h3>
      <p className="mt-1 font-label text-xs text-muted">
        Share a code (or link) so anyone can join this group.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={createInvite.isPending}
          onClick={() => {
            setError(null)
            createInvite.mutate(groupId, {
              onSuccess: setCode,
              onError: (e) => setError(errorMessage(e)),
            })
          }}
        >
          {createInvite.isPending ? 'Generating…' : 'Create invite code'}
        </Button>
        {code ? (
          <span className="font-numeral text-sm font-semibold text-accent">
            {code}
          </span>
        ) : null}
      </div>
      {link ? (
        <p className="mt-1 break-all font-label text-xs text-muted">{link}</p>
      ) : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </section>
  )
}

function Members({ groupId }: { groupId: string }) {
  const { data: members, isLoading } = useGroupMembers(groupId)
  return (
    <section>
      <h3 className="font-label text-sm font-semibold text-text">Members</h3>
      {isLoading ? (
        <p className="mt-1 font-label text-xs text-muted">Loading…</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {(members ?? []).map((m) => (
            <li
              key={m.profile_id}
              className="flex items-center justify-between font-label text-sm text-text"
            >
              <span>{m.display_name}</span>
              <span className="font-label text-xs text-muted">{m.role}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ConversionRow({ conversionId }: { conversionId: string | null }) {
  const { data: table, isLoading } = useGroupConversion(conversionId)
  return (
    <section>
      <h3 className="font-label text-sm font-semibold text-text">Conversion</h3>
      {isLoading ? (
        <p className="mt-1 font-label text-xs text-muted">Loading…</p>
      ) : table ? (
        <div className="mt-2">
          <ConversionEditor table={table} />
        </div>
      ) : (
        <p className="mt-1 font-label text-xs text-muted">
          No conversion set for this group yet.
        </p>
      )}
    </section>
  )
}

function LeaveRow({ groupId }: { groupId: string }) {
  const leave = useLeaveGroup()
  const [error, setError] = useState<string | null>(null)
  return (
    <section>
      <Button
        type="button"
        variant="secondary"
        disabled={leave.isPending}
        onClick={() => {
          setError(null)
          leave.mutate(groupId, { onError: (e) => setError(errorMessage(e)) })
        }}
      >
        {leave.isPending ? 'Leaving…' : 'Leave group'}
      </Button>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </section>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-border px-1.5 py-0.5 font-label text-xs text-muted">
      {children}
    </span>
  )
}
