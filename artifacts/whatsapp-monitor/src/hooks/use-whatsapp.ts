import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAccountStatusQueryKey,
  getGetAccountChatsQueryKey,
  getGetAccountChatMessagesQueryKey,
  getGetAccountStatsQueryKey,
  getListAccountsQueryKey,
} from '@workspace/api-client-react';

export function useWhatsappSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          accountId?: string;
          [key: string]: unknown;
        };
        const { accountId } = data;
        if (!accountId) return;

        if (data.type === 'qr' || data.type === 'status') {
          queryClient.invalidateQueries({ queryKey: getGetAccountStatusQueryKey(accountId) });
          if (data.type === 'status') {
            queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          }
        } else if (data.type === 'message') {
          queryClient.invalidateQueries({ queryKey: getGetAccountChatsQueryKey(accountId) });
          queryClient.invalidateQueries({ queryKey: getGetAccountStatsQueryKey(accountId) });
          const chatId = data.chatId as string | undefined;
          if (chatId) {
            queryClient.invalidateQueries({
              queryKey: getGetAccountChatMessagesQueryKey(accountId, chatId),
            });
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
    };
  }, [queryClient]);
}
