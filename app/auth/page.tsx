'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '../../lib/supabase'

type LoginMode = 'magic' | 'password'

export default function AuthPage() {
  const [mode, setMode] = useState<LoginMode>('magic') // ★ モード切替
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')          // ★ パスワード用
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    try {
      setLoading(true)
      setMessage('')

      if (mode === 'magic') {
        // 🔹 マジックリンクログイン
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo:
              typeof window !== 'undefined'
                ? `${window.location.origin}/`
                : undefined,
          },
        })

        if (error) throw error
        setMessage('ログインリンクをメールで送信しました！')
      } else {
        // 🔹 メール＋パスワードログイン
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        // AuthGuard が「/auth なら / にリダイレクト」してくれるので
        // ここではメッセージだけ出しておく
        setMessage('ログインに成功しました。画面を切り替えています...')
      }
    } catch (error: any) {
      setMessage(`エラー: ${error.message ?? '不明なエラーが発生しました'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-6 border rounded space-y-4">
        <h1 className="text-xl font-bold">ログイン / 新規登録</h1>

        {/* 🔁 モード切替ボタン */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('magic')}
            className={`flex-1 py-2 border rounded ${
              mode === 'magic' ? 'bg-blue-500 text-white' : 'bg-white'
            }`}
          >
            マジックリンクでログイン
          </button>
          <button
            type="button"
            onClick={() => setMode('password')}
            className={`flex-1 py-2 border rounded ${
              mode === 'password' ? 'bg-blue-500 text-white' : 'bg-white'
            }`}
          >
            パスワードでログイン
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 共通：メール */}
          <div>
            <label className="block mb-1 text-sm font-medium">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          {/* パスワードモードのときだけ表示 */}
          {mode === 'password' && (
            <div>
              <label className="block mb-1 text-sm font-medium">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded border"
          >
            {loading
              ? 'Processing...'
              : mode === 'magic'
              ? 'マジックリンクを送信'
              : 'パスワードでログイン'}
          </button>
        </form>

        {message && <p className="mt-2 text-sm">{message}</p>}
      </div>
    </div>
  )
}
