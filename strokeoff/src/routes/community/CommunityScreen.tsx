import { MeSection } from './MeSection'
import { PeopleSection } from './PeopleSection'
import { GroupsSection } from './GroupsSection'

/**
 * Community tab (spec §3, §11). Three sections — Me (identity + profile + account
 * management), People (players you've shared a round with — Phase 11), and Groups
 * (create/join/manage). Tapping a person opens their profile route.
 */
export function CommunityScreen() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <MeSection />
      <PeopleSection />
      <GroupsSection />
    </div>
  )
}
