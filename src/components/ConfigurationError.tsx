/**
 * ConfigurationError — Config validation error screen
 *
 * Mirrors Flutter RapideTicketConfigurationError widget.
 * Shown when projectId is missing or invalid.
 *
 * Usage:
 *   <ConfigurationError
 *     message="Enter a project ID: your SDK key (fad_…) or project UUID from the dashboard."
 *   />
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  message: string;
  title?: string;
  footer?: React.ReactNode;
}

export const ConfigurationError: React.FC<Props> = ({
  message,
  title = 'RapideTicket',
  footer,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    maxWidth: 420, width: '100%', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 20, padding: 28,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
  },
  icon:    { fontSize: 52 },
  title:   { fontSize: 20, fontWeight: '700', color: '#1a1a2e', textAlign: 'center' },
  message: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  footer:  { marginTop: 12, width: '100%' },
});
