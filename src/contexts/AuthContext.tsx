import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  displayName: string
  staffPic: string
  isAdmin: boolean
  isBoss: boolean
  isGuest: boolean
  isLucas: boolean
  roleReady: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [staffPic, setStaffPic] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isBoss, setIsBoss] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [isLucas, setIsLucas] = useState(false)
  // Whether the profile role has been resolved — lets App avoid briefly
  // showing internal pages to a guest before the role loads.
  const [roleReady, setRoleReady] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Load the display name + role from the profiles table when the USER changes.
  // Keyed on the user id, not the session object: supabase-js emits a fresh
  // Session on every return to the app (visibility-triggered token refresh),
  // and resetting roleReady for those would unmount the whole app via the
  // App.tsx loading gate — wiping forms, filters and scroll mid-use.
  const userId = session?.user?.id ?? null
  const userEmail = session?.user?.email
  useEffect(() => {
    const w = typeof window !== 'undefined'
      ? (window as { tennIsAdmin?: boolean; tennIsGuest?: boolean })
      : null
    if (!userId) {
      setDisplayName('')
      setStaffPic('')
      setIsAdmin(false)
      setIsBoss(false)
      setIsGuest(false)
      setIsLucas(false)
      setRoleReady(true)
      if (w) { w.tennIsAdmin = false; w.tennIsGuest = false }
      return
    }
    let active = true
    setRoleReady(false)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!active) return
        setDisplayName(
          data?.full_name ?? userEmail?.split('@')[0] ?? 'Team member'
        )
        setStaffPic((data as { staff_pic?: string } | null)?.staff_pic ?? '')
        const lucas = data?.role === 'lucas' // Lucas' personal role: boss + game GUI
        const boss = data?.role === 'boss' || lucas
        const admin = data?.role === 'admin' || boss // boss inherits admin powers
        const guest = data?.role === 'guest'
        setIsAdmin(admin)
        setIsBoss(boss)
        setIsGuest(guest)
        setIsLucas(lucas)
        setRoleReady(true)
        if (w) { w.tennIsAdmin = admin; w.tennIsGuest = guest }
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, displayName, staffPic, isAdmin, isBoss, isGuest, isLucas, roleReady, loading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
