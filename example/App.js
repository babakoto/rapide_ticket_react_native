import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Linking, Image } from 'react-native';
import { RapideTicketProvider, RapideTicket } from 'rapide-ticket';

const LogoImg = require('./assets/logo_rapide_ticket.png');

const PROJECT_ID = 'fad_f49d7158aa2c7ea7d88ba1eb75b98afc';

export default function App() {
  return (
    <RapideTicketProvider
      config={{
        projectId: PROJECT_ID,
        flavor: 'develop',
        trigger: { type: 'tap', tapCount: 5 },
        gif: { enabled: true, fps: 2 },
        debug: true,
      }}
    >
      <View style={styles.container}>
        <StatusBar style="dark" />

        <Image source={LogoImg} style={styles.logo} resizeMode="contain" />
        <Text style={styles.subtitle}>Test App</Text>

        <View style={styles.card}>
          <Text style={styles.hint}>
            Tapez <Text style={styles.bold}>5 fois</Text> n'importe où pour{'\n'}
            déclencher le rapport de bug
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => RapideTicket.open()}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>📝 Signaler un problème</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#4caf50', marginTop: 10 }]}
          onPress={() => Linking.openURL('myapp://oauth?oauth_exchange=test_code')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>🔗 Test OAuth Deep Link</Text>
        </TouchableOpacity>

        <Text style={styles.projectId} numberOfLines={1}>
          ID: {PROJECT_ID}
        </Text>
      </View>
    </RapideTicketProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 20,
  },
  logo: {
    width: 220,
    height: 70,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: -12,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    width: '100%',
  },
  hint: {
    fontSize: 15,
    color: '#444',
    textAlign: 'center',
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
    color: '#6c63ff',
  },
  button: {
    backgroundColor: '#6c63ff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    shadowColor: '#6c63ff',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  projectId: {
    fontSize: 11,
    color: '#bbb',
    fontFamily: 'monospace',
    marginTop: 8,
  },
});
