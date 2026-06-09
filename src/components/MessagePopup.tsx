import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';

export const MessagePopup: React.FC<{ userId: string }> = ({ userId }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState('');

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('receiver_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });
      setMessages(data || []);
      if (data && data.length > 0) setIsOpen(true);
    };
    if (userId) fetchMessages();
  }, [userId]);

  const handleMarkRead = async (id: string) => {
    await supabase.from('messages').update({ is_read: true }).eq('id', id);
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    await supabase.from('messages').insert([{
      sender_id: userId,
      receiver_id: 'admin',
      content: reply,
      type: 'user_to_admin',
      is_read: false,
    }]);
    setSending(false);
    setReply('');
    alert('ההודעה נשלחה למנהל!');
  };

  if (messages.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50" dir="rtl">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl shadow-blue-600/40 transition"
      >
        <MessageSquare size={22} />
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
          {messages.length}
        </span>
      </button>

      {isOpen && (
        <div className="absolute bottom-16 left-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center">
            <h3 className="font-bold text-white text-sm">📨 הודעות מהמנהל ({messages.length})</h3>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-56 overflow-y-auto">
            {messages.map(m => (
              <div key={m.id} className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-sm text-slate-700 leading-relaxed">{m.content}</p>
                <button
                  onClick={() => handleMarkRead(m.id)}
                  className="text-xs text-blue-500 hover:text-blue-700 mt-1.5"
                >
                  ✓ סמן כנקרא
                </button>
              </div>
            ))}
          </div>

          <div className="border-t p-3">
            <p className="text-xs text-slate-500 mb-2">שלח תגובה למנהל:</p>
            <form onSubmit={handleSendReply} className="flex gap-2">
              <input
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                placeholder="הודעה..."
                value={reply}
                onChange={e => setReply(e.target.value)}
              />
              <button
                disabled={sending}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition disabled:opacity-50"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
