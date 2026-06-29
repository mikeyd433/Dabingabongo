import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { HomeScreen } from '@/routes/home/HomeScreen'
import { RoundScreen } from '@/routes/round/RoundScreen'
import { RoundSetupScreen } from '@/routes/round/RoundSetupScreen'
import { RoundLobbyScreen } from '@/routes/round/RoundLobbyScreen'
import { RulesScreen } from '@/routes/rules/RulesScreen'
import { HistoryScreen } from '@/routes/history/HistoryScreen'
import { CommunityScreen } from '@/routes/community/CommunityScreen'

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
        <Route path="round/:roundId" element={<RoundLobbyScreen />} />
        <Route path="rules" element={<RulesScreen />} />
        <Route path="history" element={<HistoryScreen />} />
        <Route path="community" element={<CommunityScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
