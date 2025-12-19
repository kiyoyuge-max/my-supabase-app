'use client';

/**
 * app/page.tsx（完成版 / コメント付き）
 *
 * 目的：
 * - ブラウザの Geolocation で「現在地（緯度・経度）」を取得
 * - Next.js の Route Handler（/api/reverse-geocode）経由で Google Geocoding API に逆ジオコーディング
 * - Google の formatted_address を「県市町＋番地」までに正規化して画面に表示
 *
 * ポイント：
 * - 住所の精度は Google の formatted_address を “正” として扱う
 *   -> address_components だけで組み立てると、日本では「9-34」のようなハイフン後半が欠けるケースがあるため
 * - APIキーはクライアントに置かず、サーバ側（Route Handler）に隠蔽
 */

import {
  useState,
  useEffect,
  ChangeEvent,
  KeyboardEvent,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Todo = {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
};

export default function Home() {
  // AuthContext 側で提供されているサインアウト
  const { signOut } = useAuth();

  // Todo関連
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);

  // 位置情報関連（表示用）
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  // 初期表示で Todo を取得
  useEffect(() => {
    fetchTodos();
  }, []);

  // ============================================================
  // Supabase Edge Function 呼び出しサンプル（デモ用）
  // ============================================================
  const [msg, setMsg] = useState<string | null>(null);

  const callHello = async () => {
    try {
      const { data, error } = await supabase.functions.invoke<{
        message: string
      }>('hello-world', {
        body: { name: 'Kiyo' },
      });

      if (error) {
        console.error('Edge Function error:', error);
        setMsg(`エラー: ${error.message}`);
        return;
      }

      setMsg(data?.message ?? 'no message');
    } catch (err: any) {
      console.error('invoke failed:', err);
      setMsg(`通信エラー: ${err.message ?? String(err)}`);
    }
  };

  // ============================================================
  // Todo: 取得
  // ============================================================
  async function fetchTodos() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTodos((data ?? []) as Todo[]);
    } catch (error: any) {
      alert('Error fetching todos: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // Todo: 追加
  // ============================================================
  async function addTodo() {
    if (!newTaskTitle) return;

    try {
      const { data, error } = await supabase
        .from('todos')
        .insert([{ title: newTaskTitle }])
        .select();

      if (error) throw error;

      if (data) {
        setTodos((prev) => [...(data as Todo[]), ...prev]);
      }

      setNewTaskTitle('');
    } catch (error: any) {
      alert('Error adding todo: ' + error.message);
    }
  }

  // ============================================================
  // Todo: 完了/未完了トグル
  // ============================================================
  async function toggleTodoCompleted(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ completed: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id ? { ...todo, completed: !currentStatus } : todo
        )
      );
    } catch (error: any) {
      alert('Error updating todo: ' + error.message);
    }
  }

  // ============================================================
  // Todo: 削除
  // ============================================================
  async function deleteTodo(id: string) {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTodos((prev) => prev.filter((todo) => todo.id !== id));
    } catch (error: any) {
      alert('Error deleting todo: ' + error.message);
    }
  }

  // 入力欄の変更
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setNewTaskTitle(e.target.value);
  }

  // Enterで追加
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      addTodo();
    }
  }

  // ============================================================
  // Google Geocoding: 住所文字列の正規化
  // ============================================================
  /**
   * Google の formatted_address を「県市町＋番地」までに正規化する。
   *
   * 例）
   *  raw: "日本、〒851-0133 長崎県長崎市矢上町５０−２ アメニティーハウス１"
   *  -> "長崎県長崎市矢上町５０−２"
   *
   * 仕様：
   * - 国名（日本）を削除
   * - 郵便番号（〒xxx-xxxx）を削除
   * - 建物名が付く場合は、番地以降のスペース区切りの後半を落とす
   */
  function normalizeGoogleFormattedAddress(formatted: string): string {
    if (!formatted) return '';

    let s = formatted;

    // 先頭の国名を削除（"日本、" / "日本 " など）
    s = s.replace(/^日本[、,\s]*/u, '');

    // 先頭の郵便番号を削除（"〒123-4567 " / "123-4567 "）
    s = s.replace(/^〒?\d{3}-\d{4}\s*/u, '');

    // カンマ区切りの場合もあるので、カンマをスペースに寄せる
    s = s.replace(/,\s*/g, ' ');

    // 建物名を削除：番地の後にスペースがある場合、その後ろは建物名として落とす
    s = s.split(' ')[0];

    return s.trim();
  }

  /**
   * Google Geocoding API の status をユーザー向けメッセージに変換
   * - ユーザーには「何をすれば良いか」が伝わる文章にする
   */
  function geocodeStatusMessage(status: string): string {
    switch (status) {
      case 'ZERO_RESULTS':
        return '住所を特定できませんでした。';
      case 'OVER_QUERY_LIMIT':
        return '位置情報の取得が混み合っています。しばらくして再試行してください。';
      case 'REQUEST_DENIED':
        return '位置情報サービスの設定に問題があります。';
      case 'INVALID_REQUEST':
        return '位置情報の形式が正しくありません。';
      default:
        return `位置情報取得エラー（${status}）`;
    }
  }

  // ============================================================
  // 現在地取得 → 逆ジオコーディング（Google）
  // ============================================================
  /**
   * 1) ブラウザの Geolocation API で緯度経度を取得
   * 2) /api/reverse-geocode（Route Handler）を呼び出し
   * 3) Googleの formatted_address を正規化して住所表示
   *
   * ※ enableHighAccuracy は false（PC/Wi-Fi環境でタイムアウトしやすいため）
   * ※ APIキーはサーバ側に隠蔽している（クライアントに漏らさない）
   */
  function handleGetCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError('このブラウザは位置情報取得に対応していません。');
      return;
    }

    // UI状態初期化
    setLocating(true);
    setLocationError(null);
    setAddress(null);
    setLat(null);
    setLng(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        // 画面に緯度経度は表示したいので先にセット
        setLat(latitude);
        setLng(longitude);

        try {
          // ★ 自作Route Handler（Google Geocoding）を呼ぶ
          // - ここで Google APIキーを使う（クライアントにキーは置かない）
          const res = await fetch(
            `/api/reverse-geocode?lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();

          // HTTPレベルの失敗（サーバ側で error を返している場合）
          if (!res.ok) {
            throw new Error(data?.error ?? 'サーバーエラーが発生しました');
          }

          // Google Geocoding API の status チェック
          if (data.status !== 'OK') {
            throw new Error(geocodeStatusMessage(data.status));
          }

          // 一般に先頭の results[0] が最も妥当（Route Handler 側で result_type 等を絞っている前提）
          const raw = data.results?.[0]?.formatted_address ?? '';
          const normalized = normalizeGoogleFormattedAddress(raw);

          // normalized を優先して表示（番地まで残し、建物名は落とす）
          setAddress(normalized || raw || '住所を特定できませんでした');

          // デバッグログ（必要なら残す）
          console.log('[GEO]', { latitude, longitude, accuracy });
          console.log('[GEOCODE raw]', raw);
          console.log('[GEOCODE normalized]', normalized);
        } catch (err: any) {
          console.error('[GEOCODE ERROR]', err);
          setLocationError(err.message ?? '住所の取得に失敗しました。');
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        // 位置情報取得のエラー（ユーザー操作や端末設定が原因になりやすい）
        console.error('[GEO ERROR]', error);

        let msg = '位置情報の取得に失敗しました。';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = '位置情報の利用が許可されていません。';
            break;
          case error.POSITION_UNAVAILABLE:
            msg = '現在地を取得できませんでした。';
            break;
          case error.TIMEOUT:
            msg = '位置情報の取得がタイムアウトしました。';
            break;
          default:
            // error.message はブラウザによって内容がまちまちなので、ログのみ詳しく残す
            msg = '位置情報の取得中にエラーが発生しました。';
            break;
        }

        setLocationError(msg);
        setLocating(false);
      },
      {
        // PC/Wi-Fi環境で enableHighAccuracy:true だとタイムアウトしやすいので false 推奨
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 0,
      }
    );
  }

  // ============================================================
  // UI
  // ============================================================
  return (
    <main className="max-w-xl mx-auto p-4">
      {/* 右上ログアウトボタン */}
      <div className="flex justify-end mb-4">
        <button
          onClick={signOut}
          className="px-4 py-2 border rounded bg-red-500 text-white"
        >
          ログアウト
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-4">My Todo List</h1>

      {/* 入力欄＋追加ボタン */}
      <div className="flex mb-4">
        <input
          value={newTaskTitle}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="flex-grow p-2 border rounded-l"
          placeholder="新しいタスクを入力"
        />
        <button
          onClick={addTodo}
          className="px-4 py-2 rounded-r bg-blue-500 text-white"
        >
          追加
        </button>
      </div>

      {/* Todo一覧 */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul className="space-y-2 mb-8">
          {todos.map((todo) => (
            <li key={todo.id} className="flex items-center">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodoCompleted(todo.id, todo.completed)}
                className="mr-2"
              />
              <span
                className={`flex-grow ${todo.completed ? 'line-through text-gray-400' : ''
                  }`}
              >
                {todo.title}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="text-red-500"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 現在地取得エリア */}
      <div className="border-t pt-4 mt-4">
        <button
          onClick={handleGetCurrentLocation}
          disabled={locating}
          className="px-4 py-2 border rounded bg-green-500 text-white disabled:opacity-60"
        >
          {locating ? '現在地取得中...' : '現在地の住所を取得'}
        </button>

        {/* エラー表示（ユーザー向けは簡潔に） */}
        {locationError && (
          <p className="mt-2 text-sm text-red-500">{locationError}</p>
        )}

        {/* 住所＆緯度経度表示 */}
        {(address || (lat !== null && lng !== null)) && (
          <div className="mt-2 text-sm">
            {address && (
              <p>
                <span className="font-bold">住所：</span>
                <br />
                {address}
              </p>
            )}

            {lat !== null && lng !== null && (
              <p className="mt-2">
                <span className="font-bold">緯度：</span> {lat}
                <br />
                <span className="font-bold">経度：</span> {lng}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Supabase Edge Function 呼び出し（デモ） */}
      <button
        onClick={callHello}
        className="px-4 py-2 border rounded bg-blue-500 text-white"
      >
        hello-world を呼ぶ
      </button>

      {msg && <p className="mt-4">{msg}</p>}
    </main>
  );
}