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

---

## 🧪 Running the Example (Local Testing)

An example Expo application is available in the `example` folder to quickly test and debug the package during development.

To run it:

1. **Build and pack the library** at the root of `rapide_ticket_rn`:
   ```bash
   npm run pack-local
   ```

2. **Navigate to the example directory**:
   ```bash
   cd example
   ```

3. **Install dependencies** (uses the local package tarball):
   ```bash
   npm install
   ```

4. **Launch the application** on iOS or Android:
   ```bash
   npx expo run:ios
   # or
   npx expo run:android
   ```

For detailed guides and deep link testing, please refer to the [example README](file:///Users/mandresy/Documents/DEV/Flutter/packages/rapide_ticket_rn/example/README.md).

