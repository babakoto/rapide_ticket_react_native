import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { RapideTicketConfig } from '../types';
import { SecretTriggerLayer } from './SecretTriggerLayer';
import { RapideTicketModal } from './RapideTicketModal';
import { SignInModal } from './SignInModal';
import { AuthService } from '../services/AuthService';
import { captureScreen } from 'react-native-view-shot';

interface RapideTicketContextValue {
  config: RapideTicketConfig;
  openPanel: () => void;
  closePanel: () => void;
}

const RapideTicketContext = createContext<RapideTicketContextValue | null>(null);

export const useRapideTicket = () => {
  const ctx = useContext(RapideTicketContext);
  if (!ctx) throw new Error('Must be used within RapideTicketProvider');
  return ctx;
};

interface Props {
  config: RapideTicketConfig;
  children: React.ReactNode;
}

// Global ref for imperative API (RapideTicket.open())
export const _rapideTicketRef = {
  openPanel: () => {},
  isReady: false,
};

export const RapideTicketProvider: React.FC<Props> = ({ config, children }) => {
  const [signInVisible, setSignInVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const isCapturing = useRef(false);

  useEffect(() => {
    _rapideTicketRef.isReady = true;
    _rapideTicketRef.openPanel = openWithCapture;
    return () => { _rapideTicketRef.isReady = false; };
  }, []);

  /**
   * Full trigger flow (mirrors Flutter SDK):
   * 1. Capture screenshot BEFORE any UI appears
   * 2. Check authentication
   *    - Not signed in → show SignInModal
   *    - Signed in     → show FeedbackModal directly
   */
  const openWithCapture = async () => {
    if (isCapturing.current || modalVisible || signInVisible) return;
    isCapturing.current = true;

    // Step 1: Capture the screen in its current state
    let uri: string | null = null;
    try {
      uri = await captureScreen({ format: 'png', quality: 0.8 });
    } catch (e) {
      console.warn('[RapideTicket] Screen capture failed:', e);
    } finally {
      isCapturing.current = false;
    }

    setPreviewUri(uri);

    // Step 2: Check auth — show sign-in or feedback
    const token = await AuthService.getToken();
    if (!token) {
      setSignInVisible(true);
    } else {
      setModalVisible(true);
    }
  };

  /** Called when sign-in succeeds → move to feedback modal */
  const handleSignInSuccess = () => {
    setSignInVisible(false);
    setModalVisible(true);
  };

  const closeAll = () => {
    setSignInVisible(false);
    setModalVisible(false);
    setPreviewUri(null);
  };

  return (
    <RapideTicketContext.Provider
      value={{ config, openPanel: openWithCapture, closePanel: closeAll }}
    >
      <SecretTriggerLayer config={config} onTrigger={openWithCapture}>
        {children}
      </SecretTriggerLayer>

      {/* Authentication gate — shown when user is not signed in */}
      <SignInModal
        visible={signInVisible}
        config={config}
        onSuccess={handleSignInSuccess}
        onClose={closeAll}
      />

      {/* Bug report form — shown only after authentication */}
      <RapideTicketModal
        visible={modalVisible}
        onClose={closeAll}
        previewUri={previewUri}
      />
    </RapideTicketContext.Provider>
  );
};
