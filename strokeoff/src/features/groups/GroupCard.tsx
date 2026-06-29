import { useState } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { ConversionEditor } from '@/features/conversion/ConversionEditor'
import { errorMessage } from '@/lib/validation'
import {
  useCreateInvite,
  useDeleteGroup,
  useGroupMembers,
  useLeaveGroup,
  useRemoveMember,
  useRenameGroup,
  useTransferOwnership,
} from '@/lib/groups'
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
          {isOwner && !group.is_personal ? (
            <RenameRow groupId={group.id} name={group.name} />
          ) : null}
          <InviteRow groupId={group.id} />
          <Members
            group={group}
            isOwner={isOwner}
            currentUserId={currentUserId}
          />
          <ConversionRow conversionId={group.default_conversion_id} />
          {!group.is_personal && !isOwner ? (
            <LeaveRow groupId={group.id} />
          ) : null}
          {isOwner && !group.is_personal ? (
            <DangerRow groupId={group.id} name={group.name} />
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/** Owner-only: rename the group (spec §11). */
function RenameRow({ groupId, name }: { groupId: string; name: string }) {
  const rename = useRenameGroup()
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  return (
    <section>
      <h3 className="font-label text-sm font-semibold text-text">Group name</h3>
      <div className="mt-2 flex gap-2">
        <TextInput
          value={value}
          aria-label="Group name"
          onChange={(e) => {
            setValue(e.target.value)
            setSaved(false)
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={rename.isPending || value.trim() === name}
          onClick={() => {
            setError(null)
            rename.mutate(
              { groupId, name: value.trim() },
              {
                onSuccess: () => setSaved(true),
                onError: (e) => setError(errorMessage(e)),
              },
            )
          }}
        >
          {rename.isPending ? 'Saving…' : 'Rename'}
        </Button>
      </div>
      {saved ? <FormMessage tone="success">Renamed.</FormMessage> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </section>
  )
}

/** Owner-only: delete the group, behind a confirm step (spec §11). */
function DangerRow({ groupId, name }: { groupId: string; name: string }) {
  const del = useDeleteGroup()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <section>
      <h3 className="font-label text-sm font-semibold text-text">Delete group</h3>
      <p className="mt-1 font-label text-xs text-muted">
        Removes {name} and its rules and conversion for everyone. This can't be
        undone.
      </p>
      {confirming ? (
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            disabled={del.isPending}
            onClick={() => {
              setError(null)
              del.mutate(groupId, { onError: (e) => setError(errorMessage(e)) })
            }}
          >
            {del.isPending ? 'Deleting…' : 'Delete for everyone'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirming(false)}
            disabled={del.isPending}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          onClick={() => setConfirming(true)}
        >
          Delete group
        </Button>
      )}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </section>
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

function Members({
  group,
  isOwner,
  currentUserId,
}: {
  group: Group
  isOwner: boolean
  currentUserId: string
}) {
  const { data: members, isLoading } = useGroupMembers(group.id)
  const removeMember = useRemoveMember()
  const transfer = useTransferOwnership()
  const [error, setError] = useState<string | null>(null)
  // Owner tools only make sense in a shared group with more than just you.
  const canManage = isOwner && !group.is_personal

  return (
    <section>
      <h3 className="font-label text-sm font-semibold text-text">Members</h3>
      {isLoading ? (
        <p className="mt-1 font-label text-xs text-muted">Loading…</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {(members ?? []).map((m) => {
            const isSelf = m.profile_id === currentUserId
            const manageable = canManage && !isSelf
            return (
              <li
                key={m.profile_id}
                className="flex items-center justify-between gap-2 font-label text-sm text-text"
              >
                <span className="min-w-0 truncate">{m.display_name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-label text-xs text-muted">
                    {m.role}
                  </span>
                  {manageable ? (
                    <>
                      <button
                        type="button"
                        disabled={transfer.isPending}
                        className="font-label text-xs text-accent underline disabled:opacity-50"
                        onClick={() => {
                          setError(null)
                          if (
                            !window.confirm(
                              `Hand off ownership of ${group.name} to ${m.display_name}? You'll become a member.`,
                            )
                          )
                            return
                          transfer.mutate(
                            { groupId: group.id, newOwnerId: m.profile_id },
                            { onError: (e) => setError(errorMessage(e)) },
                          )
                        }}
                      >
                        Make owner
                      </button>
                      <button
                        type="button"
                        disabled={removeMember.isPending}
                        className="font-label text-xs text-muted underline disabled:opacity-50"
                        onClick={() => {
                          setError(null)
                          removeMember.mutate(
                            { groupId: group.id, profileId: m.profile_id },
                            { onError: (e) => setError(errorMessage(e)) },
                          )
                        }}
                      >
                        Remove
                      </button>
                    </>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
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
