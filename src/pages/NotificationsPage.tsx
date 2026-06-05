import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from '../lib/localFirestore';
import { db, auth, handleFirestoreError } from '../lib/auth';
import { Notification } from '../lib/types';
import { Bell, Check, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, `users/${auth.currentUser.uid}/notifications`),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = [];
      snapshot.forEach(doc => {
        notifs.push({ id: doc.id, ...doc.data() } as Notification);
      });
      setNotifications(notifs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, 'list', 'notifications');
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (notifId: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, `users/${auth.currentUser.uid}/notifications`, notifId), {
        isRead: true
      });
    } catch (error) {
      handleFirestoreError(error, 'update', 'notifications');
    }
  };

  const deleteNotification = async (notifId: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, `users/${auth.currentUser.uid}/notifications`, notifId));
    } catch (error) {
      handleFirestoreError(error, 'delete', 'notifications');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-semibold tracking-tight mb-6">알림</h2>

      {loading ? (
        <div className="py-8 text-center text-neutral-500">불러오는 중...</div>
      ) : notifications.length === 0 ? (
        <div className="border border-dashed border-neutral-300 rounded-xl p-12 text-center bg-neutral-50">
          <Bell className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">새로운 알림이 없습니다.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map(notif => (
            <li 
              key={notif.id} 
              className={`p-4 rounded-xl border ${notif.isRead ? 'bg-white border-neutral-100 text-neutral-500' : 'bg-blue-50 border-blue-100 text-neutral-900'} flex items-start justify-between`}
            >
              <div className="flex items-start flex-1 mr-4">
                 <div className={`mt-1 mr-3 rounded-full w-2 h-2 shrink-0 ${notif.isRead ? 'bg-neutral-300' : 'bg-blue-500'}`} />
                 <div>
                   <p className="text-sm font-medium leading-relaxed">{notif.message}</p>
                   <span className="text-xs text-neutral-400 mt-2 block">
                     {notif.createdAt ? formatDistanceToNow(notif.createdAt, { addSuffix: true, locale: ko }) : '방금 전'}
                   </span>
                 </div>
              </div>
              <div className="flex space-x-2 shrink-0">
                {!notif.isRead && (
                  <button 
                    onClick={() => markAsRead(notif.id)}
                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => deleteNotification(notif.id)}
                  className="p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-500 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
