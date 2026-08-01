import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { HomeScreen } from '@/routes/home/HomeScreen'
import { RoundScreen } from '@/routes/round/RoundScreen'
import { RoundSetupScreen } from '@/routes/round/RoundSetupScreen'
import { RoundDetailScreen } from '@/routes/round/RoundDetailScreen'
import { RulesScreen } from '@/routes/rules/RulesScreen'
import { CoursesScreen } from '@/routes/courses/CoursesScreen'
import { DirectoryScreen } from '@/routes/courses/DirectoryScreen'
import { DirectoryCourseScreen } from '@/routes/courses/DirectoryCourseScreen'
import { HistoryScreen } from '@/routes/history/HistoryScreen'
import { CommunityScreen } from '@/routes/community/CommunityScreen'
import { PlayerProfileScreen } from '@/routes/community/PlayerProfileScreen'

/**
 * App routes. The five static tabs render inside the persistent Layout shell
 * (spec §3); the tab bar never changes, only the routed content does.
 */
export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeScreen />} />
        <Route path="round" element={<RoundScreen />} />
        <Route path="round/new" element={<RoundSetupScreen />} />
        <Route path="round/:roundId" element={<RoundDetailScreen />} />
        <Route path="rules" element={<RulesScreen />} />
        <Route path="courses" element={<CoursesScreen />} />
        {/* Shared reference directory behind the group's saved-course bank. */}
        <Route path="courses/directory" element={<DirectoryScreen />} />
        <Route
          path="courses/directory/:courseId"
          element={<DirectoryCourseScreen />}
        />
        <Route path="history" element={<HistoryScreen />} />
        <Route path="community" element={<CommunityScreen />} />
        <Route
          path="community/people/:profileId"
          element={<PlayerProfileScreen />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
