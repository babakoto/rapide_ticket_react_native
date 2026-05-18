import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { RapideTicketConfig } from '../types';
import { SecretTriggerLayer } from './SecretTriggerLayer';
import { RapideTicketModal } from './RapideTicketModal';
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

// Global ref for imperative API
export const _rapideTicketRef = {
  openPanel: () => {},
  isReady: false,
};

export const RapideTicketProvider: React.FC<Props> = ({ config, children }) => {
  const [modalVisible, setModalVisible] = useState(false);
  // Pre-captured screenshot taken BEFORE the modal opens
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const isCapturing = useRef(false);

  useEffect(() => {
    _rapideTicketRef.isReady = true;
    _rapideTicketRef.openPanel = () => openWithCapture();
    return () => {
      _rapideTicketRef.isReady = false;
    };
  }, []);

  /**
   * Captures the screen FIRST, then opens the modal.
   * This mirrors the Flutter SDK behavior: the screenshot shows the app state
   * before the report UI appeared.
   */
  const openWithCapture = async () => {
    if (isCapturing.current || modalVisible) return;
    isCapturing.current = true;
    try {
      const uri = await captureScreen({ format: 'png', quality: 0.8 });
      setPreviewUri(uri);
    } catch (e) {
      console.warn('[RapideTicket] Screen capture failed:', e);
      setPreviewUri(null);
    } finally {
      isCapturing.current = false;
      setModalVisible(true);
    }
  };

  const closePanel = () => {
    setModalVisible(false);
    setPreviewUri(null);
  };

  return (
    <RapideTicketContext.Provider
      value={{
        config,
        openPanel: openWithCapture,
        closePanel,
      }}
    >
      <SecretTriggerLayer config={config} onTrigger={openWithCapture}>
        {children}
      </SecretTriggerLayer>
      <RapideTicketModal
        visible={modalVisible}
        onClose={closePanel}
        previewUri={previewUri}
      />
    </RapideTicketContext.Provider>
  );
};
