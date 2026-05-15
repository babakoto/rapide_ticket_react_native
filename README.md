# rapide-ticket

Bug reporting in-app for React Native, inspired by the Flutter `rapide_ticket` package.

## Installation

```bash
npm install rapide-ticket react-native-view-shot react-native-device-info @react-native-async-storage/async-storage react-native-keychain react-native-fs react-native-reanimated react-native-gesture-handler react-native-sensors axios
```

## Usage

Wrap your root component with the `RapideTicketProvider`:

```tsx
import { RapideTicketProvider } from 'rapide-ticket';
import { NavigationContainer } from '@react-navigation/native';

export default function App() {
  return (
    <RapideTicketProvider
      config={{
        projectId: 'fad_XXXXXXXX',
        flavor: 'develop',
        trigger: { type: 'shake' },
        gif: { enabled: true, bufferSeconds: 5 },
        jira: {
          host: 'monentreprise.atlassian.net',
          projectKey: 'MYAPP',
        },
        theme: 'auto',
      }}
    >
      <NavigationContainer>
        {/* ... */}
      </NavigationContainer>
    </RapideTicketProvider>
  );
}
```

## Programmatic Control

```typescript
import { RapideTicket } from 'rapide-ticket';

// Open manually
RapideTicket.open();

// Capture and open
RapideTicket.captureAndOpen();

// Check if ready
RapideTicket.isReady();
```
