import Login from './pages/Login.tsx'
import Register from './pages/Register.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Users from './pages/Users.tsx'
import Profile from './pages/account/profile.tsx'
import Security from './pages/account/security.tsx'
import Preferences from './pages/account/preferences.tsx'

export const pages: Record<string, React.ComponentType<any>> = {
  Login,
  Register,
  Dashboard,
  Users,
  Profile,
  Security,
  Preferences,
}
