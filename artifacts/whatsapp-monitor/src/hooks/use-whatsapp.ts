import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetChatsQueryKey, useGetWhatsappStatus, getGetChatMessagesQueryKey, getGetWhatsappStatsQueryKey, getGetWhatsappStatusQueryKey } from '@workspace/api-client-react';

export function useWhatsapp() {
  const queryClient = useQueryClient();
  const [wsState, setWsState] = useState<{
    qr?: string | null;
    qrDataUrl?: string | null;
  }>({});

  const { data: statusData } = useGetWhatsappStatus({
    query: {
      refetchInterval: 5000,
      queryKey: getGetWhatsappStatusQueryKey(),
    }
  });

  useEffect(() => {
    const wsUrl = window.location.protocol === 'https:' ? 'wss://' : 'ws://' + window.location.host + '/ws';
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'qr') {
          setWsState(prev => ({ ...prev, qr: data.qr, qrDataUrl: data.qrDataUrl }));
        } else if (data.type === 'status') {
          // Force invalidate status query
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
        } else if (data.type === 'message') {
          queryClient.invalidateQueries({ queryKey: getGetChatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWhatsappStatsQueryKey() });
          
          if (data.chatId) {
            queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey(data.chatId) });
          }
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [queryClient]);

  return {
    status: statusData,
    qr: wsState.qr,
    qrDataUrl: wsState.qrDataUrl,
  };
}
