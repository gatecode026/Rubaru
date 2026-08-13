import React, { createContext, useContext, useState } from 'react';
import { useRouter } from 'expo-router';
import IncomingCallBanner from './IncomingCallBanner';

const IncomingCallContext = createContext();

export function IncomingCallProvider({ children }) {
  const router = useRouter();
  const [callData, setCallData] = useState(null);

  const triggerIncomingCall = (data = {}) => {
    setCallData({
      contactName: data.contactName || 'Rahul Kumawat',
      avatarUri: data.avatarUri || 'https://i.pravatar.cc/150?img=11',
      callType: data.callType || 'voice',
    });
  };

  const handleAccept = () => {
    if (!callData) return;
    const { contactName, avatarUri, callType } = callData;
    setCallData(null);
    router.push({
      pathname: '/active-call',
      params: {
        contactName,
        avatarUri,
        callType,
        initialStatus: 'connected',
      },
    });
  };

  const handleDecline = () => {
    setCallData(null);
  };

  return (
    <IncomingCallContext.Provider value={{ triggerIncomingCall }}>
      {children}
      <IncomingCallBanner
        visible={!!callData}
        contactName={callData?.contactName || ''}
        avatarUri={callData?.avatarUri || ''}
        callType={callData?.callType || 'voice'}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </IncomingCallContext.Provider>
  );
}

export function useIncomingCall() {
  const context = useContext(IncomingCallContext);
  if (!context) {
    return { triggerIncomingCall: () => {} };
  }
  return context;
}
