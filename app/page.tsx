'use client';

import Image from "next/image";
import {
  useState,
  useEffect,
  ChangeEvent,
  KeyboardEvent,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext'; // ★ 追加

type Todo = {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
};

export default function Home() {
  const { signOut } = useAuth(); // ★ 追加

  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);

  // 位置情報関連
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  // 初期表示で Todo を取得
  useEffect(() => {
    fetchTodos();
  }, []);

  // ↓↓SupabaseのEdge Functionの利用例
  const [msg, setMsg] = useState<string | null>(null)
  const callHello = async () => {
    try {
      const { data, error } = await supabase.functions.invoke<{
        message: string
      }>('hello-world', {
        body: { name: 'Kiyo' },  // ← Edge Function 側の { name } に対応
      })

      if (error) {
        console.error('Edge Function error:', error)
        setMsg(`エラー: ${error.message}`)
        return
      }

      setMsg(data?.message ?? 'no message')
    } catch (err: any) {
      console.error('invoke そのものが失敗:', err)
      setMsg(`通信エラー: ${err.message ?? String(err)}`)
    }
  }
  // ↑↑SupabaseのEdge Functionの利用例

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

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setNewTaskTitle(e.target.value);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      addTodo();
    }
  }

  // ★ 日本式住所フォーマット
  function formatJapaneseAddress(addr: any): string {
    if (!addr) return '';

    const postcode = addr.postcode || '';

    const prefecture =
      addr.state ||
      addr.province ||
      addr.region ||
      '';

    const city =
      addr.city ||
      addr.city_district ||
      addr.town ||
      addr.village ||
      addr.county ||
      '';

    const town =
      addr.suburb ||
      addr.neighbourhood ||
      addr.hamlet ||
      addr.quarter ||
      '';

    const block = addr.block || '';
    const road = addr.road || '';
    const houseNumber = addr.house_number || '';

    const parts = [
      prefecture,
      city,
      town,
      block,
      `${road}${houseNumber}`,
    ].filter((p) => p && p.trim().length > 0);

    const core = parts.join(' ');

    return postcode ? `〒${postcode} ${core}` : core;
  }

  // 現在地取得 → 住所＆緯度経度セット
  function handleGetCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError('このブラウザは位置情報取得に対応していません。');
      return;
    }

    setLocating(true);
    setLocationError(null);
    setAddress(null);
    setLat(null);
    setLng(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        setLat(latitude);
        setLng(longitude);

        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`;

          const res = await fetch(url, {
            headers: { 'User-Agent': 'my-nextjs-app' },
          });

          if (!res.ok) throw new Error('住所情報の取得に失敗しました');

          const data = await res.json();
          console.log('Nominatim raw data:', data);
          console.log('Nominatim address:', data.address);

          const formatted = formatJapaneseAddress(data.address);

          setAddress(formatted || '住所を特定できませんでした');
        } catch (err: any) {
          setLocationError(err.message ?? '住所の取得に失敗しました。');
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('位置情報の利用が拒否されました。');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('位置情報を取得できませんでした。');
            break;
          case error.TIMEOUT:
            setLocationError('位置情報の取得がタイムアウトしました。');
            break;
          default:
            setLocationError('位置情報の取得中にエラーが発生しました。');
        }
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );
  }

  return (
    <main className="max-w-xl mx-auto p-4">

      {/* ★ 右上ログアウトボタン */}
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

        {locationError && (
          <p className="mt-2 text-sm text-red-500">{locationError}</p>
        )}

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
      <button
        onClick={callHello}
        className="px-4 py-2 border rounded bg-blue-500 text-white">
        hello-world を呼ぶ
      </button>

      {msg && <p className="mt-4">{msg}</p>}
    </main>
  );
}
