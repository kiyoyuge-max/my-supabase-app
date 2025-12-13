'use client'

import { useAuth } from '../contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return

    // 未ログインで /auth 以外 → /auth へ
    if (!user && pathname !== '/auth') {
      router.replace('/auth')
    }

    // ログイン済みで /auth にいる → / へ
    if (user && pathname === '/auth') {
      router.replace('/')
    }
  }, [user, loading, pathname, router])

  // ★ ここがポイント

  // まだセッション確認中 → 何も出さない（or ローディング表示でもOK）
  if (loading) {
    return null
    // return <div className="p-4">Checking session...</div> みたいにしてもOK
  }

  // 未ログイン & /auth 以外 → リダイレクト中なので何も表示しない
  if (!user && pathname !== '/auth') {
    return null
  }

  // ログイン済み & /auth → リダイレクト中なので何も表示しない
  if (user && pathname === '/auth') {
    return null
  }

  // それ以外（正しい組み合わせ）のときだけ子要素を表示
  return <>{children}</>
}
