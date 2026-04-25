import { get, set, del, entries } from 'idb-keyval';

export type RetrospectiveStatus = 'SATISFIED' | 'UNSATISFIED' | 'NEEDS_MORE';

export interface SessionRetrospective {
  status: RetrospectiveStatus;
  answers: {
    question: string;
    answer: string;
  }[];
  createdAt: number;
}

export interface WarRoomState {
  sessionId: string;
  title: string;
  lastModified: number;
  payload: any; // Context: The full Conversation object
  retrospective?: SessionRetrospective;
}

export const SessionManager = {
  async saveSession(session: WarRoomState): Promise<void> {
    await set(`session_${session.sessionId}`, session);
  },

  async loadSession(sessionId: string): Promise<WarRoomState | undefined> {
    return await get(`session_${sessionId}`);
  },

  async deleteSession(sessionId: string): Promise<void> {
    await del(`session_${sessionId}`);
  },

  async getAllSessions(): Promise<WarRoomState[]> {
    const allEntries = await entries();
    const sessions = allEntries
      .filter(([key]) => (key as string).startsWith('session_'))
      .map(([_, value]) => value as WarRoomState);

    return sessions.sort((a, b) => b.lastModified - a.lastModified);
  },

  // Helper for one-time migration from localStorage
  async migrateFromLocalStorage(): Promise<void> {
    const STORAGE_KEY = 'the-council-conversations';
    const lsData = localStorage.getItem(STORAGE_KEY);
    if (lsData) {
      try {
        const parsed = JSON.parse(lsData);
        if (Array.isArray(parsed)) {
          for (const conv of parsed) {
            const session: WarRoomState = {
              sessionId: conv.id,
              title: conv.title || 'Legacy Conversation',
              lastModified: conv.createdAt || Date.now(),
              payload: conv
            };
            // Only migrate if it doesn't already exist in IDB
            const existing = await this.loadSession(session.sessionId);
            if (!existing) {
              await this.saveSession(session);
            }
          }
        }
      } catch (e) {
        console.error('Failed to migrate from localStorage', e);
      }
      localStorage.removeItem(STORAGE_KEY); // Clean up after successful migration
    }
  }
};
