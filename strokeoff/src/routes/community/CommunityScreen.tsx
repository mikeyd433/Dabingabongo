import { MeSection } from './MeSection'
import { PeopleSection } from './PeopleSection'
import { GroupsSection } from './GroupsSection'

/**
 * Community tab (spec §3, §11). Three sections — Me, People, Groups. Phase 1
 * delivers Me (identity + profile + account management) and surfaces the personal
 * group; People and group create/join arrive in later phases.
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
