import React, { createContext, useContext, useState, useEffect } from 'react';
import { RapideTicketConfig } from '../types';
import { SecretTriggerLayer } from './SecretTriggerLayer';
import { RapideTicketModal } from './RapideTicketModal';

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

  useEffect(() => {
    _rapideTicketRef.isReady = true;
    _rapideTicketRef.openPanel = () => setModalVisible(true);
    return () => {
      _rapideTicketRef.isReady = false;
    };
  }, []);

  return (
    <RapideTicketContext.Provider
      value={{
        config,
        openPanel: () => setModalVisible(true),
        closePanel: () => setModalVisible(false),
      }}
    >
      <SecretTriggerLayer config={config} onTrigger={() => setModalVisible(true)}>
        {children}
      </SecretTriggerLayer>
      <RapideTicketModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </RapideTicketContext.Provider>
  );
};
