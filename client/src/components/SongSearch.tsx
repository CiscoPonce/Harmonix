'use client';

import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Music, User, Play, Loader2 } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface Track {
  id: number;
  title: string;
  artist: {
    name: string;
    picture_small: string;
  };
  album: {
    title: string;
    cover_small: string;
  };
}

export function SongSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    async function search() {
      setLoading(true);
      try {
        const res = await apiFetch(`/search?q=${encodeURIComponent(debouncedQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.data || []);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }

    search();
  }, [debouncedQuery]);

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
          ) : (
            <SearchIcon className="h-5 w-5 text-zinc-500 group-focus-within:text-white transition-colors" />
          )}
        </div>
        <Input
          type="text"
          placeholder="Search for a song or artist to start learning..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-12 py-6 bg-zinc-950 border-zinc-800 text-lg focus:border-white transition-all rounded-xl"
        />
      </div>

      {results.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-900 animate-in fade-in slide-in-from-top-2 duration-300">
          {results.slice(0, 6).map((track) => (
            <Link 
              key={track.id} 
              href={`/player/${track.id}`}
              className="flex items-center p-4 hover:bg-zinc-900 transition-colors group"
            >
              <img 
                src={track.album.cover_small} 
                alt={track.album.title} 
                className="w-12 h-12 rounded-lg object-cover border border-zinc-800"
              />
              <div className="ml-4 flex-1 min-w-0">
                <h4 className="font-bold text-white truncate group-hover:text-yellow-400 transition-colors uppercase italic tracking-tighter">
                  {track.title}
                </h4>
                <p className="text-xs text-zinc-500 truncate uppercase tracking-widest font-medium">
                  {track.artist.name}
                </p>
              </div>
              <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" className="text-white bg-zinc-800">
                  <Play className="h-4 w-4 fill-current" />
                </Button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && !loading && (
        <div className="p-12 text-center bg-zinc-950 border border-zinc-800 rounded-xl border-dashed">
          <Music className="h-8 w-8 text-zinc-800 mx-auto mb-3" />
          <p className="text-zinc-600 text-sm font-medium uppercase tracking-widest">No songs found for "{query}"</p>
        </div>
      )}
    </div>
  );
}
