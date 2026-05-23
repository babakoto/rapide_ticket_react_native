import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { View } from 'react-native';
import { RapideTicketConfig } from '../types';
import { SecretTriggerLayer } from './SecretTriggerLayer';
import { RapideTicketModal } from './RapideTicketModal';
import { SignInScreen } from './SignInScreen';
import { AuthService } from '../services/AuthService';
import { captureScreen, captureRef } from 'react-native-view-shot';
import { useOAuthDeepLink } from '../hooks/useOAuthDeepLink';
import { RapideTicketAPIClient } from '../services/RapideTicketAPIClient';

interface RapideTicketContextValue {
  config: RapideTicketConfig;
  openPanel: () => void;
  closePanel: () => void;
  openPanelDirectly: () => void;
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
  openPanel: (opts?: { inviteToken?: string }) => {},
  openWithEditedCapture: (uri: string, opts?: { inviteToken?: string }) => {},
  isReady: false,
};

export const RapideTicketProvider: React.FC<Props> = ({ config, children }) => {
  const [signInVisible, setSignInVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const isCapturing = useRef(false);
  const activeInviteToken = useRef<string | undefined>(undefined);
  const containerRef = useRef<View>(null);

  const apiClient = useMemo(() => new RapideTicketAPIClient(config.projectId, config.flavor), [config.projectId, config.flavor]);

  useOAuthDeepLink(apiClient, {
    onSuccess: () => {
      console.log('[RapideTicket] OAuth Success');
      handleSignInSuccess();
    },
    onError: (msg) => console.warn('[RapideTicket] OAuth Error:', msg),
    inviteToken: activeInviteToken.current,
  });

  useEffect(() => {
    _rapideTicketRef.isReady = true;
    _rapideTicketRef.openPanel = openWithCapture;
    _rapideTicketRef.openWithEditedCapture = openWithEditedCapture;
    return () => { _rapideTicketRef.isReady = false; };
  }, []);

  const handleOpenFlow = async (uri: string | null, opts?: { inviteToken?: string }) => {
    if (opts?.inviteToken) {
      activeInviteToken.current = opts.inviteToken;
    }
    setPreviewUri(uri);

    const token = await AuthService.getToken();
    if (!token) {
      setSignInVisible(true);
    } else {
      setModalVisible(true);
    }
  };

  const openWithCapture = async (opts?: { inviteToken?: string }) => {
    if (isCapturing.current || modalVisible || signInVisible) return;
    isCapturing.current = true;

    // Small delay to allow layout / transitions to settle
    await new Promise((resolve) => setTimeout(resolve, 150));

    let uri: string | null = null;
    try {
      if (containerRef.current) {
        if (config.debug) {
          console.log('[RapideTicket] Attempting captureRef on container...');
        }
        uri = await captureRef(containerRef, { format: 'png', quality: 0.8 });
      } else {
        if (config.debug) {
          console.log('[RapideTicket] Attempting captureScreen fallback...');
        }
        uri = await captureScreen({ format: 'png', quality: 0.8 });
      }
    } catch (e) {
      console.warn('[RapideTicket] Screen capture via captureRef failed:', e);
      try {
        // Fallback to captureScreen
        uri = await captureScreen({ format: 'png', quality: 0.8 });
      } catch (e2) {
        console.warn('[RapideTicket] Screen capture fallback failed:', e2);
      }
    } finally {
      isCapturing.current = false;
    }

    handleOpenFlow(uri, opts);
  };

  const openWithEditedCapture = async (uri: string, opts?: { inviteToken?: string }) => {
    if (modalVisible || signInVisible) return;
    handleOpenFlow(uri, opts);
  };

  const openPanelDirectly = async () => {
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
    activeInviteToken.current = undefined;
  };

  return (
    <RapideTicketContext.Provider
      value={{ config, openPanel: openWithCapture, closePanel: closeAll, openPanelDirectly }}
    >
      <View style={{ flex: 1 }}>
        <SecretTriggerLayer config={config} onTrigger={openWithCapture}>
          <View ref={containerRef} style={{ flex: 1 }} collapsable={false}>
            {children}
          </View>
        </SecretTriggerLayer>

        {/* Authentication gate — shown when user is not signed in */}
        {signInVisible && (
          <SignInScreen
            visible={true}
            config={config}
            onSuccess={handleSignInSuccess}
            onClose={closeAll}
            inviteToken={activeInviteToken.current}
          />
        )}

        {/* Bug report form — shown only after authentication */}
        <RapideTicketModal
          visible={modalVisible}
          onClose={closeAll}
          previewUri={previewUri}
          inviteToken={activeInviteToken.current}
        />
      </View>
    </RapideTicketContext.Provider>
  );
};
